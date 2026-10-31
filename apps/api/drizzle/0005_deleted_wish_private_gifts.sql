DO $$
DECLARE
  commitment record;
  gift_id uuid;
BEGIN
  FOR commitment IN
    SELECT r.id,r.creator_id,w.id AS wish_id
    FROM reservations r JOIN wishes w ON w.id=r.wish_id
    WHERE w.deleted_at IS NOT NULL AND NOT w.off_list
      AND r.cancelled_at IS NULL AND r.status<>'gifted'
  LOOP
    INSERT INTO wishes(owner_id,title,description,url,image,price,tags,off_list,created_by)
      SELECT owner_id,title,description,url,image,price,tags,true,commitment.creator_id
      FROM wishes WHERE id=commitment.wish_id RETURNING id INTO gift_id;
    UPDATE reservations SET wish_id=gift_id,open_to_contributions=false WHERE id=commitment.id;
  END LOOP;
END $$;
