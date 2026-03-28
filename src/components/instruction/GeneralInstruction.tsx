import {
  StepCard, InfoBadge, Illustration, FlowDiagram,
} from "@/components/instruction/InstructionComponents";

export default function GeneralInstruction() {
  return (
    <div className="space-y-6">
      {/* 1. Назначение */}
      <div>
        <h3 className="text-xl font-bold mb-2">Назначение портала</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Портал DocStroy — система для ведения строительной исполнительной документации в электронном виде.
          Здесь вы создаёте ячейки (акты, схемы, протоколы), прикрепляете к ним файлы, отправляете на проверку и подпись,
          а после подписания — в архив. Также через портал можно подавать заявки геодезической службе
          и обмениваться файлами с другими участниками проекта.
        </p>
      </div>

      {/* Общая схема */}
      <div className="p-5 rounded-xl" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
        <h4 className="font-semibold mb-2" style={{ color: "var(--ds-text)" }}>Общая схема работы с ячейкой</h4>
        <Illustration>
          <FlowDiagram items={[
            { label: "Создать ячейку", color: "bg-blue-100", icon: <PlusIcon /> },
            { label: "Отправить на проверку", color: "bg-purple-100", icon: <SendIcon /> },
            { label: "Подписать", color: "bg-amber-100", icon: <CheckIcon /> },
            { label: "Подписать на бумаге", color: "bg-emerald-100", icon: <PenIcon /> },
            { label: "Прикрепить скан и отправить в архив", color: "bg-gray-200", icon: <ArchiveIcon /> },
          ]} />
        </Illustration>
      </div>

      {/* 2. Роли */}
      <div>
        <h3 className="text-xl font-bold mb-2">Роли пользователей</h3>
        <p className="mb-3" style={{ color: "var(--ds-text-muted)" }}>
          Каждому участнику проекта назначается роль. От роли зависит, какие действия доступны.
          Администратор проекта может дополнительно настроить разрешения для каждого пользователя.
        </p>
        <div className="space-y-2">
          {[
            { role: "Исполнитель", desc: "Создаёт ячейки, прикрепляет файлы, отправляет на проверку и в архив.", color: "bg-blue-100 text-blue-700" },
            { role: "Проверяющий", desc: "Получает ячейки на проверку: подписывает, отклоняет, пишет замечания или пересылает другому проверяющему.", color: "bg-amber-100 text-amber-700" },
            { role: "Исполнитель и проверяющий", desc: "Совмещает обе роли: может создавать свои ячейки и проверять чужие.", color: "bg-purple-100 text-purple-700" },
            { role: "Авторский надзор", desc: "Согласовывает ячейки от имени авторского надзора.", color: "bg-cyan-100 text-cyan-700" },
            { role: "Производитель работ", desc: "Получает ячейки на ознакомление, создаёт заявки геодезистам.", color: "bg-orange-100 text-orange-700" },
            { role: "Комментатор", desc: "Может просматривать ячейки и оставлять комментарии.", color: "bg-emerald-100 text-emerald-700" },
            { role: "Читатель", desc: "Только просмотр ячеек и скачивание файлов.", color: "bg-gray-100 text-gray-700" },
          ].map((item) => (
            <div key={item.role} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--ds-surface-sunken)" }}>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${item.color}`}>{item.role}</span>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Вход */}
      <div>
        <h3 className="text-xl font-bold mb-2">Вход в систему</h3>
      </div>

      <StepCard step={1} title="Откройте портал" color="blue">
        <p>Перейдите по ссылке, которую вам выдал администратор.</p>
      </StepCard>

      <StepCard step={2} title="Введите фамилию" color="blue">
        <p>В поле <InfoBadge>Фамилия</InfoBadge> начните вводить свою фамилию. Система предложит совпадения — выберите свой профиль из списка.</p>
      </StepCard>

      <StepCard step={3} title="Введите пароль" color="blue">
        <p>Введите пароль (минимум 6 символов) и нажмите <strong>«Войти»</strong>.</p>
        <p className="mt-1">Если вы входите впервые с временным паролем, система попросит задать новый пароль. Окно нельзя закрыть, пока пароль не будет изменён.</p>
      </StepCard>

      <div className="p-4 rounded-xl" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))", border: "1px solid color-mix(in srgb, #f59e0b 30%, var(--ds-border))" }}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          <div className="text-sm" style={{ color: "#f59e0b" }}>
            <p><strong>Забыли пароль?</strong> Нажмите «Забыли пароль?» на странице входа. Обычным пользователям нужно обратиться к администратору портала для восстановления доступа.</p>
          </div>
        </div>
      </div>

      <StepCard step={4} title="Выберите проект" color="green">
        <p>После входа откроется ваш проект. Если вы участвуете в нескольких проектах, переключайтесь между ними через выпадающий список в верхней части экрана.</p>
      </StepCard>

      {/* 4. Навигация */}
      <div>
        <h3 className="text-xl font-bold mb-2">Навигация по порталу</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Слева находится боковое меню с разделами портала. На мобильных устройствах меню открывается по кнопке ☰ в верхнем левом углу.
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>Основные разделы:</p>
          <p>&bull; <strong>Реестр</strong> — главный раздел, все ячейки проекта</p>
          <p>&bull; <strong>ГРО</strong> — геодезическая разбивочная основа</p>
          <p>&bull; <strong>Проводник</strong> — дерево файлов по иерархии</p>
          <p>&bull; <strong>План / Фасады / Благоустройство</strong> — ячейки на чертежах</p>
          <p>&bull; <strong>Шахматка</strong> — матричный отчёт по ячейкам</p>
          <p>&bull; <strong>Заявки</strong> — заявки геодезической службе (если включено)</p>
          <p>&bull; <strong>Обмен файлами</strong> — отправка файлов коллегам</p>
          <p>&bull; <strong>Задачи</strong> — общий список входящих и исходящих задач</p>
          <p>&bull; <strong>Админ</strong> — настройки проекта (только для администраторов)</p>
        </div>
      </div>

      {/* 5. Уведомления */}
      <div>
        <h3 className="text-xl font-bold mb-2">Уведомления</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          В правом верхнем углу находится значок колокольчика. Красный кружок с числом показывает
          количество непрочитанных уведомлений. Нажмите на колокольчик, чтобы увидеть список.
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>Уведомления приходят, когда:</p>
          <p>&bull; Вам отправили ячейку на проверку, ознакомление или согласование</p>
          <p>&bull; Проверяющий подписал или отклонил вашу ячейку</p>
          <p>&bull; Вам отправили файлы через «Обмен файлами»</p>
          <p>&bull; Создана новая заявка (для исполнителей)</p>
          <p>&bull; Заявка выполнена, отклонена или получено замечание (для создателя)</p>
        </div>
      </div>

      <div className="p-4 rounded-xl" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", border: "1px solid var(--ds-border)" }}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--ds-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm" style={{ color: "var(--ds-accent)" }}>
            <p><strong>Push-уведомления:</strong> Нажмите на колокольчик и включите переключатель «Push-уведомления» внизу панели, чтобы получать оповещения, даже когда портал закрыт.</p>
          </div>
        </div>
      </div>

      {/* 6. Профиль */}
      <div>
        <h3 className="text-xl font-bold mb-2">Личный кабинет</h3>
        <p style={{ color: "var(--ds-text-muted)" }}>
          Нажмите на своё имя в правом верхнем углу. В личном кабинете можно изменить имя (фамилию и инициалы) и сменить пароль.
        </p>
        <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; Для смены пароля введите новый пароль (минимум 6 символов) и подтвердите его.</p>
          <p>&bull; Для выхода из системы нажмите кнопку <strong>«Выйти»</strong>.</p>
        </div>
      </div>

      {/* 7. Дополнительные возможности */}
      <div>
        <h3 className="text-xl font-bold mb-2">Дополнительные возможности</h3>
        <div className="space-y-1 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          <p>&bull; <strong>Тёмная тема:</strong> переключите в нижней части бокового меню.</p>
          <p>&bull; <strong>Установить как приложение:</strong> нажмите кнопку «Установить приложение» внизу бокового меню, чтобы добавить портал на рабочий стол как отдельное приложение.</p>
          <p>&bull; <strong>Скачать PDF инструкции:</strong> нажмите кнопку «Скачать PDF» в правом верхнем углу этой страницы.</p>
        </div>
      </div>

      {/* 8. Краткая памятка */}
      <div>
        <h3 className="text-xl font-bold mb-2">Краткая памятка</h3>
      </div>

      <div className="p-5 rounded-xl" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
        <div className="space-y-2">
          {[
            { n: 1, text: "Войдите по фамилии и паролю." },
            { n: 2, text: "Создайте ячейку: заполните поля, прикрепите файлы." },
            { n: 3, text: "Отправьте ячейку на проверку выбранному проверяющему." },
            { n: 4, text: "Дождитесь решения: подпись, замечания или пересылка." },
            { n: 5, text: "При замечаниях — исправьте и отправьте повторно." },
            { n: 6, text: "После подписания — подпишите на бумаге." },
            { n: 7, text: "Прикрепите скан подписанного документа и отправьте ячейку в архив." },
            { n: 8, text: "Следите за задачами — входящие ячейки требуют ваших действий." },
            { n: 9, text: "Проверяйте уведомления (колокольчик в правом верхнем углу)." },
            { n: 10, text: "Используйте фильтры и поиск для быстрого поиска ячеек." },
          ].map((item) => (
            <div key={item.n} className="flex items-start gap-3">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--ds-accent)", color: "#fff" }}
              >{item.n}</span>
              <p className="text-sm pt-0.5" style={{ color: "var(--ds-text-muted)" }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function SendIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
}
function CheckIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>;
}
function PenIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
}
function ArchiveIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>;
}
