-- Normaliza phone_number já gravados que vieram com sufixo de device (`:NN`) ou separador de grupo (`-NN`).
-- Idempotente: só altera registros que casarem com a regex.

update public.contacts
   set phone_number = regexp_replace(phone_number, '[:\-]\d+$', '')
 where phone_number ~ '[:\-]\d+$';

-- Garante que phone_number só contenha dígitos.
update public.contacts
   set phone_number = regexp_replace(phone_number, '\D', '', 'g')
 where phone_number is not null and phone_number ~ '\D';
