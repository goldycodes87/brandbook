CREATE OR REPLACE FUNCTION adjust_straw(p_inventory_id uuid, p_delta int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE semen_inventory
    SET straw_count = straw_count + p_delta
    WHERE id = p_inventory_id
      AND straw_count + p_delta >= 0
    RETURNING straw_count INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_STRAWS' USING ERRCODE = 'check_violation';
  END IF;

  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_straw(uuid, int) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
