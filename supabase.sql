-- Run this script once in the Supabase SQL Editor for the project used by a.html.
-- The 32+ character shared code is a bearer secret: only share it with trusted users.
-- Never put a Supabase service-role key in the browser.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.tienda_sync_stores (
    code_hash bytea PRIMARY KEY,
    payload jsonb NOT NULL,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tienda_sync_stores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tienda_sync_stores FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_store(
    p_code text,
    p_action text,
    p_payload jsonb DEFAULT NULL,
    p_expected_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
    v_hash bytea;
    v_store public.tienda_sync_stores%ROWTYPE;
    v_created boolean := false;
    v_new_revision bigint;
    v_rows bigint;
BEGIN
    IF p_code IS NULL OR char_length(p_code) < 12 OR char_length(p_code) > 128 THEN
        RAISE EXCEPTION 'Invalid shared code' USING ERRCODE = '22023';
    END IF;

    IF p_action IS NULL OR p_action NOT IN ('open', 'sync', 'write') THEN
        RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023';
    END IF;

    v_hash := extensions.digest(convert_to(p_code, 'UTF8'), 'sha256');

    IF p_action = 'open' THEN
        IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
            OR jsonb_typeof(p_payload->'productos') IS DISTINCT FROM 'array'
            OR jsonb_typeof(p_payload->'transacciones') IS DISTINCT FROM 'array'
            OR pg_column_size(p_payload) > 1048576 THEN
            RAISE EXCEPTION 'Invalid initial data' USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.tienda_sync_stores (code_hash, payload)
        VALUES (v_hash, p_payload)
        ON CONFLICT (code_hash) DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_created := v_rows > 0;
    END IF;

    IF p_action = 'write' THEN
        IF p_expected_revision IS NULL OR p_payload IS NULL
            OR jsonb_typeof(p_payload) <> 'object'
            OR jsonb_typeof(p_payload->'productos') IS DISTINCT FROM 'array'
            OR jsonb_typeof(p_payload->'transacciones') IS DISTINCT FROM 'array'
            OR pg_column_size(p_payload) > 1048576 THEN
            RAISE EXCEPTION 'Invalid update' USING ERRCODE = '22023';
        END IF;

        UPDATE public.tienda_sync_stores
        SET payload = p_payload,
            revision = revision + 1,
            updated_at = now()
        WHERE code_hash = v_hash
          AND revision = p_expected_revision
        RETURNING revision INTO v_new_revision;

        IF v_new_revision IS NULL THEN
            RETURN jsonb_build_object('ok', true, 'conflict', true);
        END IF;

        RETURN jsonb_build_object('ok', true, 'conflict', false, 'revision', v_new_revision);
    END IF;

    SELECT * INTO v_store
    FROM public.tienda_sync_stores
    WHERE code_hash = v_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shared store not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'created', v_created,
        'revision', v_store.revision,
        'payload', v_store.payload
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_store(text, text, jsonb, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_store(text, text, jsonb, bigint) TO anon, authenticated;
