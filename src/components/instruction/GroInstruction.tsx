import {
  StepCard, InfoBadge, MockButton,
} from "@/components/instruction/InstructionComponents";

export default function GroInstruction() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">ГРО — Геодезическая разбивочная основа</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Раздел «ГРО» предназначен для хранения файлов геодезической разбивочной основы: схем закрепления геодезических пунктов, результатов измерений и другой геодезической документации. Каждая запись привязана к месту работ и может содержать несколько файлов с версионностью.
        </p>
      </div>

      {/* Просмотр */}
      <div>
        <h3 className="text-xl font-bold mb-2">Просмотр записей</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          В разделе отображается таблица (или карточки на мобильных) со всеми записями ГРО. Для каждой записи видно: дату создания, место работ, уровень, описание и количество файлов.
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; Нажмите на строку, чтобы открыть карточку записи.</p>
          <p>&bull; Используйте сортировку по столбцам: дата, место работ, описание, уровень, формат файла.</p>
          <p>&bull; Внизу можно менять количество строк на странице.</p>
        </div>
      </div>

      {/* Фильтры */}
      <div>
        <h3 className="text-xl font-bold mb-2">Фильтры и поиск</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; <InfoBadge>Место работ</InfoBadge> — по зданию/корпусу</p>
          <p>&bull; <InfoBadge>Уровни и виды</InfoBadge> — по уровню/этажу</p>
          <p>&bull; <InfoBadge>Дата</InfoBadge> — по периоду</p>
          <p>&bull; <InfoBadge>Поиск</InfoBadge> — по месту работ, уровню или описанию</p>
        </div>
      </div>

      {/* Создание */}
      <div>
        <h3 className="text-xl font-bold mb-2">Создание записи ГРО</h3>
      </div>

      <StepCard step={1} title="Нажмите «Добавить»" color="blue">
        <p>В правом верхнем углу нажмите <MockButton>+ Добавить</MockButton>.</p>
      </StepCard>

      <StepCard step={2} title="Заполните поля" color="blue">
        <p>&bull; <strong>Место работ</strong> — обязательное поле, выберите из справочника.</p>
        <p>&bull; <strong>Уровни и виды</strong> — необязательное поле.</p>
        <p>&bull; <strong>Описание</strong> — текстовое описание.</p>
      </StepCard>

      <StepCard step={3} title="Прикрепите файлы" color="blue">
        <p>Добавьте один или несколько файлов. Нажмите <MockButton variant="green">Создать</MockButton>.</p>
      </StepCard>

      <div className="p-4 rounded-xl" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", border: "1px solid var(--ds-border)" }}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--ds-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm" style={{ color: "var(--ds-accent)" }}>
            <p><strong>Дубликаты:</strong> Если запись с таким же сочетанием места работ и уровня уже существует, система предупредит и предложит открыть существующую запись.</p>
          </div>
        </div>
      </div>

      {/* Карточка записи */}
      <div>
        <h3 className="text-xl font-bold mb-2">Карточка записи</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          В карточке можно:
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; Редактировать данные (место работ, уровень, описание) — если есть разрешение.</p>
          <p>&bull; Просматривать прикреплённые файлы (изображения открываются в превью).</p>
          <p>&bull; Скачивать файлы.</p>
          <p>&bull; Добавлять новые файлы.</p>
          <p>&bull; Обновлять файлы с сохранением версий — старая версия не удаляется, а сохраняется в истории.</p>
          <p>&bull; Удалить запись (доступно только администраторам).</p>
        </div>
      </div>
    </div>
  );
}
