import {
  StepCard, InfoBadge, MockButton,
} from "@/components/instruction/InstructionComponents";

export default function RequestsInstruction() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Заявки</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Раздел «Заявки» предназначен для подачи и обработки заявок на выполнение геодезических работ.
          Создатели заявок описывают, какие работы нужно выполнить, а исполнители (геодезисты) принимают и выполняют их.
        </p>
      </div>

      {/* Вкладки */}
      <div>
        <h3 className="text-xl font-bold mb-2">Вкладки</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; <InfoBadge>В работе</InfoBadge> — активные заявки, ожидающие выполнения</p>
          <p>&bull; <InfoBadge color="green">Выполнено</InfoBadge> — заявки, которые были выполнены или отклонены и ожидают подтверждения создателем</p>
          <p>&bull; <InfoBadge color="purple">История</InfoBadge> — все завершённые заявки</p>
        </div>
      </div>

      {/* Создание заявки */}
      <div>
        <h3 className="text-xl font-bold mb-2">Создание заявки</h3>
        <p className="mb-3" style={{ color: "var(--ds-text-muted)" }}>
          Для создания заявки нужно разрешение <InfoBadge color="green">Создание заявок</InfoBadge>, которое назначает администратор проекта.
        </p>
      </div>

      <StepCard step={1} title="Нажмите «Добавить»" color="blue">
        <p>В правом верхнем углу раздела нажмите <MockButton>+ Добавить</MockButton>.</p>
      </StepCard>

      <StepCard step={2} title="Заполните поля" color="blue">
        <p>&bull; <strong>Тип заявки</strong> — выберите тип: Съемка, Разбивка, Проверка, Повторная съемка или Вынос репера.</p>
        <p>&bull; <strong>Место работ</strong> — выберите из справочника (обязательно).</p>
        <p>&bull; <strong>Вид работ</strong> — выберите из справочника (обязательно).</p>
        <p>&bull; <strong>Уровни/срезы</strong> / <strong>Конструкции</strong> — необязательно, зависит от настроек справочников.</p>
        <p>&bull; <strong>Описание</strong> — опишите, что нужно сделать.</p>
      </StepCard>

      <StepCard step={3} title="Прикрепите файлы и отправьте" color="blue">
        <p>При необходимости прикрепите файлы и нажмите <MockButton variant="green">Создать</MockButton>. Заявка получит статус «В работе» и будет видна исполнителям.</p>
      </StepCard>

      {/* Выполнение заявки */}
      <div>
        <h3 className="text-xl font-bold mb-2">Выполнение заявки (для исполнителей)</h3>
      </div>

      <StepCard step={1} title="Найдите заявку" color="green">
        <p>На вкладке «В работе» найдите нужную заявку. Также можно найти её в разделе «Задачи».</p>
      </StepCard>

      <StepCard step={2} title="Выполните или отклоните" color="green">
        <p>Нажмите кнопку выполнения (зелёная галочка). В открывшемся окне прикрепите файлы с результатами и добавьте комментарий. Нажмите <MockButton variant="green">Выполнить</MockButton>.</p>
        <p className="mt-1">Если заявку нельзя выполнить, нажмите кнопку отклонения (красный крестик) и укажите причину.</p>
      </StepCard>

      {/* Подтверждение */}
      <div>
        <h3 className="text-xl font-bold mb-2">Подтверждение выполнения (для создателей)</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          После того как исполнитель выполнил или отклонил заявку, создатель видит её на вкладке «Выполнено». Нажмите кнопку «Ознакомлен», чтобы подтвердить, что вы видели результат. После этого заявка перейдёт в историю.
        </p>
      </div>

      {/* Фильтры */}
      <div>
        <h3 className="text-xl font-bold mb-2">Фильтры и поиск</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; <InfoBadge>Тип заявки</InfoBadge> — по типу геодезических работ</p>
          <p>&bull; <InfoBadge>Место работ</InfoBadge> — по зданию/корпусу</p>
          <p>&bull; <InfoBadge>Вид работ</InfoBadge> — по виду работ</p>
          <p>&bull; <InfoBadge>Уровни</InfoBadge> — по этажу</p>
          <p>&bull; <InfoBadge>Конструкции</InfoBadge> — по конструктивному элементу</p>
          <p>&bull; <InfoBadge>Дата</InfoBadge> — по периоду</p>
          <p>&bull; <InfoBadge>Поиск</InfoBadge> — по тексту</p>
          <p>&bull; Переключатель <strong>«Только мои»</strong> — показать только свои заявки</p>
        </div>
      </div>

      {/* Статусы */}
      <div>
        <h3 className="text-xl font-bold mb-2">Статусы заявок</h3>
        <div className="space-y-2">
          {[
            { status: "В работе", desc: "Заявка создана и ожидает выполнения исполнителем.", color: "bg-amber-100 text-amber-700" },
            { status: "Выполнено", desc: "Исполнитель выполнил заявку. Создатель может ознакомиться с результатом.", color: "bg-emerald-100 text-emerald-700" },
            { status: "Отклонено", desc: "Исполнитель отклонил заявку с указанием причины.", color: "bg-red-100 text-red-700" },
          ].map((item) => (
            <div key={item.status} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${item.color}`}>{item.status}</span>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Карточка заявки */}
      <div>
        <h3 className="text-xl font-bold mb-2">Карточка заявки</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Нажмите на заявку, чтобы открыть её карточку. В ней можно:
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; Просмотреть все данные заявки (тип, место, вид работ, описание).</p>
          <p>&bull; Просмотреть прикреплённые файлы и скачать их.</p>
          <p>&bull; Просмотреть замечания и комментарии.</p>
          <p>&bull; Редактировать заявку (если есть разрешение и заявка ещё не выполнена).</p>
          <p>&bull; Удалить заявку (если есть разрешение).</p>
          <p>&bull; Просмотреть маршрут согласования.</p>
        </div>
      </div>

      <div className="p-4 rounded-xl" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", border: "1px solid var(--ds-border)" }}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--ds-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm" style={{ color: "var(--ds-accent)" }}>
            <p><strong>Важно:</strong> Доступ к разделу «Заявки» по умолчанию отключён для всех ролей, кроме администраторов. Администратор проекта должен включить разрешения на просмотр, создание и выполнение заявок для каждого пользователя через панель «Админ».</p>
          </div>
        </div>
      </div>
    </div>
  );
}
