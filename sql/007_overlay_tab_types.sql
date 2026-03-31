-- Расширение tab_type для подложек: новые типы из карты «Процесс строительства»
-- Выполнить вручную в Supabase SQL Editor

ALTER TABLE dict_overlays
  DROP CONSTRAINT IF EXISTS dict_overlays_tab_type_check;

ALTER TABLE dict_overlays
  ADD CONSTRAINT dict_overlays_tab_type_check
    CHECK (tab_type IS NULL OR tab_type = ANY(ARRAY[
      'plan', 'facades', 'landscaping',
      'roof', 'floors', 'walls', 'frame',
      'territory', 'earthwork', 'foundation', 'shoring', 'piles'
    ]));
