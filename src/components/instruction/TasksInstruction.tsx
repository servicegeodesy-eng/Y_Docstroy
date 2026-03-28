import {
  InfoBadge,
} from "@/components/instruction/InstructionComponents";

export default function TasksInstruction() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Задачи</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Раздел «Задачи» — единый центр всех ваших входящих и исходящих действий.
          Здесь собраны ячейки реестра, заявки и файлы, которые требуют вашего внимания или были отправлены вами.
        </p>
      </div>

      {/* Структура раздела */}
      <div>
        <h3 className="text-xl font-bold mb-2">Структура раздела</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Раздел разделён на три блока:
        </p>
        <div className="mt-2 space-y-2">
          {[
            { name: "Реестр", desc: "Ячейки, требующие ваших действий (проверка, подпись, ознакомление) или отправленные вами." },
            { name: "Заявки", desc: "Заявки геодезической службе, где вы исполнитель или создатель." },
            { name: "Файлообмен", desc: "Файлы, полученные от других участников проекта." },
          ].map((item) => (
            <div key={item.name} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{item.name}</span>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Вкладки */}
      <div>
        <h3 className="text-xl font-bold mb-2">Вкладки</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p><strong>Активные задачи:</strong></p>
          <p>&bull; <InfoBadge>Входящие</InfoBadge> — ячейки, которые отправлены вам на проверку, ознакомление или согласование</p>
          <p>&bull; <InfoBadge>Исходящие</InfoBadge> — ячейки, которые вы отправили и ждёте результата</p>
          <p>&bull; <InfoBadge>Все</InfoBadge> — все активные задачи одним списком</p>
          <p className="mt-2"><strong>История:</strong></p>
          <p>&bull; <InfoBadge color="green">Вся история</InfoBadge> — завершённые задачи</p>
          <p>&bull; <InfoBadge color="green">История входящих</InfoBadge> — ячейки, по которым вы приняли решение</p>
          <p>&bull; <InfoBadge color="green">История исходящих</InfoBadge> — ячейки, по которым вам ответили</p>
        </div>
      </div>

      {/* Действия */}
      <div>
        <h3 className="text-xl font-bold mb-2">Доступные действия</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          В зависимости от типа задачи и вашей роли, доступны разные действия:
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p><strong>Для ячеек реестра:</strong></p>
          <p>&bull; Открыть карточку ячейки</p>
          <p>&bull; Подписать, отклонить, написать замечания</p>
          <p>&bull; Переслать или делегировать другому проверяющему</p>
          <p>&bull; Отметить ознакомление</p>
          <p>&bull; Отправить в архив</p>
          <p>&bull; Скачать файлы</p>
          <p className="mt-2"><strong>Для заявок:</strong></p>
          <p>&bull; Выполнить заявку</p>
          <p>&bull; Отклонить заявку</p>
          <p className="mt-2"><strong>Для файлов:</strong></p>
          <p>&bull; Просмотреть или скачать полученные файлы</p>
        </div>
      </div>

      {/* Счётчики */}
      <div>
        <h3 className="text-xl font-bold mb-2">Счётчики</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Рядом с названиями блоков «Заявки» и «Файлообмен» отображаются счётчики непрочитанных/ожидающих элементов. Это помогает быстро понять, что требует внимания.
        </p>
      </div>
    </div>
  );
}
