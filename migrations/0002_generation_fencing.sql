ALTER TABLE generations ADD COLUMN lease_owner TEXT;
CREATE TRIGGER generation_terminal_immutable
BEFORE UPDATE OF status ON generations
WHEN OLD.status IN ('completed','failed','cancelled') AND NEW.status != OLD.status
BEGIN
 SELECT RAISE(ABORT,'generation_terminal_immutable');
END;
