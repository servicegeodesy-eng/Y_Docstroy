import {
  StepCard, InfoBadge, MockButton,
} from "@/components/instruction/InstructionComponents";

export default function FileShareInstruction() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Обмен файлами</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Раздел «Обмен файлами» позволяет отправлять файлы другим участникам проекта.
          Это отдельная система, не связанная с ячейками реестра — используйте её для любого обмена документами между коллегами.
        </p>
      </div>

      {/* Вкладки */}
      <div>
        <h3 className="text-xl font-bold mb-2">Вкладки</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; <InfoBadge>Входящие</InfoBadge> — файлы, которые вам отправили. Непрочитанные выделены синей точкой. Счётчик показывает количество непрочитанных.</p>
          <p>&bull; <InfoBadge>Исходящие</InfoBadge> — файлы, которые вы отправили другим.</p>
          <p>&bull; <InfoBadge>Черновики</InfoBadge> — сохранённые, но ещё не отправленные файлы.</p>
          <p>&bull; <InfoBadge>Все</InfoBadge> — все файлы одним списком.</p>
          <p>&bull; <InfoBadge color="red">Корзина</InfoBadge> — удалённые файлы. Хранятся 14 дней, после чего удаляются автоматически.</p>
        </div>
      </div>

      {/* Отправка */}
      <div>
        <h3 className="text-xl font-bold mb-2">Отправка файлов</h3>
      </div>

      <StepCard step={1} title="Нажмите «Добавить»" color="blue">
        <p>В правом верхнем углу нажмите <MockButton>+ Добавить</MockButton>.</p>
      </StepCard>

      <StepCard step={2} title="Прикрепите файлы" color="blue">
        <p>Добавьте один или несколько файлов. Система показывает счётчик файлов и общий размер.</p>
      </StepCard>

      <StepCard step={3} title="Выберите получателей" color="blue">
        <p>В поле получателей начните вводить имя — система предложит участников проекта. Можно выбрать несколько получателей.</p>
      </StepCard>

      <StepCard step={4} title="Добавьте комментарий и привязку (необязательно)" color="blue">
        <p>Добавьте текстовый комментарий. При необходимости привяжите файлы к справочникам проекта (место работ, вид работ и т.д.) и нарисуйте область на подложке.</p>
      </StepCard>

      <StepCard step={5} title="Отправьте" color="green">
        <p>Нажмите <MockButton variant="green">Отправить</MockButton>. Получатели увидят файлы во «Входящих» и получат уведомление.</p>
      </StepCard>

      {/* Просмотр и скачивание */}
      <div>
        <h3 className="text-xl font-bold mb-2">Просмотр и скачивание</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; Нажмите на строку, чтобы открыть карточку — там видны все получатели, статус прочтения и файлы.</p>
          <p>&bull; Файлы можно просмотреть (изображения, PDF) или скачать по одному.</p>
          <p>&bull; Кнопка «Скачать все» загружает все файлы как ZIP-архив.</p>
          <p>&bull; При открытии входящего файла он автоматически помечается как прочитанный.</p>
        </div>
      </div>

      {/* Фильтры */}
      <div>
        <h3 className="text-xl font-bold mb-2">Фильтры и поиск</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; <InfoBadge>Место работ</InfoBadge>, <InfoBadge>Вид работ</InfoBadge>, <InfoBadge>Уровни/срезы</InfoBadge>, <InfoBadge>Конструкция</InfoBadge>, <InfoBadge>Выполняемая работа</InfoBadge>, <InfoBadge>Метка</InfoBadge> — если файлы были привязаны к справочникам</p>
          <p>&bull; <InfoBadge>Дата</InfoBadge> — по периоду отправки</p>
          <p>&bull; <InfoBadge>Поиск</InfoBadge> — по комментарию, метке или имени файла</p>
          <p>&bull; Сортировка по дате (от новых к старым или наоборот)</p>
        </div>
      </div>

      {/* Корзина */}
      <div>
        <h3 className="text-xl font-bold mb-2">Корзина</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Удалённые файлы попадают в корзину. Из корзины можно очистить все файлы сразу. Также можно удалить все черновики одной кнопкой.
        </p>
      </div>

      <div className="p-4 rounded-xl" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))", border: "1px solid color-mix(in srgb, #f59e0b 30%, var(--ds-border))" }}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          <div className="text-sm" style={{ color: "#f59e0b" }}>
            <p><strong>Важно:</strong> Файлы в корзине хранятся 14 дней, после чего удаляются автоматически.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
