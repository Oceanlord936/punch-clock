-- Sample data, loaded once when the jobs table is empty.



INSERT INTO employees (employee_number, name) VALUES
  (4521, 'Maria Lopez'),
  (4522, 'Sam Chen'),
  (4523, 'Priya Patel');

INSERT INTO jobs (job_number, title, quantity, description, instructions_url) VALUES
  (1042, 'Aluminum Housing Bracket', 12,
   'Machine and finish 12 aluminum housing brackets to customer spec. Includes deburring, anodizing, and final QA inspection before shipment.',
   'https://example.com/assembly-instructions-1042.pdf'),
  (1047, 'Steel Mounting Plate', 20,
   'Cut, drill and powder-coat 20 steel mounting plates.',
   'https://example.com/assembly-instructions-1047.pdf'),
  (1051, 'Custom Gearbox Housing', 2,
   'Cast and machine 2 gearbox housings. Pressure-test before shipment.',
   'https://example.com/assembly-instructions-1051.pdf'),
  (1055, 'Conveyor Bracket Assembly', 8,
   'Weld and assemble 8 conveyor brackets with mounting hardware.',
   'https://example.com/assembly-instructions-1055.pdf'),
  (1058, 'Precision Shaft Coupling', 30,
   'Turn and balance 30 shaft couplings to 0.01 mm tolerance.',
   'https://example.com/assembly-instructions-1058.pdf');

INSERT INTO job_parts (job_number, part_number, qty) VALUES
  (1042, 'HSG-AL-100', 12),   -- aluminum housing
  (1042, 'BLT-M4-SH', 48),    -- M4 socket-head bolts
  (1042, 'GSK-RB-12', 12),    -- rubber gasket seal
  (1047, 'PLT-ST-3020', 20),  -- steel plate 300x200 mm
  (1051, 'CST-GBX-01', 2),    -- gearbox casting
  (1051, 'KIT-BRG-SL', 2),    -- bearing seal kit
  (1055, 'BLK-BRKT-08', 8),   -- bracket blank
  (1055, 'BLT-M6-HX', 32),    -- M6 hex bolts
  (1058, 'BAR-ST-40', 30);    -- steel bar stock 40 mm

-- A few finished work events, so the report has something to show (October 2026).
-- strftime('%s', <local time>, 'utc') -> UTC epoch seconds; * 1000 -> ms like Date.now()
INSERT INTO work_events (employee_number, job_number, start_ms, end_ms) VALUES
  (4521, 1047, strftime('%s', '2026-10-05 08:00:00', 'utc') * 1000, strftime('%s', '2026-10-05 11:30:00', 'utc') * 1000),
  (4521, 1051, strftime('%s', '2026-10-05 12:15:00', 'utc') * 1000, strftime('%s', '2026-10-05 16:45:00', 'utc') * 1000),
  (4521, 1055, strftime('%s', '2026-10-06 08:10:00', 'utc') * 1000, strftime('%s', '2026-10-06 17:30:00', 'utc') * 1000);

