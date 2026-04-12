# ОЧЕНЬ ВАЖНО ТО, ЧТО ВСЕ ЭТО НУЖНО КРАСИВО АДАПТИРОВАТЬ БОЛЬШЕ ПОД ТЕЛЕФОННУЮ ВЕБ-ВЕРСИЮ, ЧЕМ К ПК. ПОТОМУ ЧТО В ЭТУ ИГРУ ПРИЕМУЩЕСТВЕННО БУДУТ ИГРАТЬ ЛЮДИ С ТЕЛЕФОНА. 
# ДЛЯ ВВОДА ТЕКСТА НО ТОЛЬКО КРАСНОГО ОТТЕНКА 
.input {
  font-family: 'Segoe UI', sans-serif;
  margin: 1em 0 1em 0;
  max-width: 190px;
  position: relative;
}

.input input {
  font-size: 100%;
  padding: 0.8em;
  outline: none;
  border: 2px solid rgb(141, 109, 255);
  background-color: transparent;
  border-radius: 20px;
  width: 100%;
}

.input label {
  font-size: 100%;
  position: absolute;
  left: 0;
  padding: 0.8em;
  margin-left: 0.5em;
  pointer-events: none;
  transition: all 0.3s ease;
  color: rgb(255, 255, 255);
}

.input :is(input:focus, input:valid)~label {
  transform: translateY(-50%) scale(.9);
  margin: 0em;
  margin-left: 1.3em;
  padding: 0.4em;
  background-color: #212121;
}

.inputGroup :is(input:focus, input:valid) {
  border-color: rgb(37, 37, 211);
}

# НА ЭТО СИЛЬНО ОПИРАТЬСЯ ПРИ ДИЗАЙНЕ СТРАНИЦ ОСТАЛЬНЫХ (СТИЛЬ) ТОЛЬКО В КРАСНЫХ ЦВЕТАХ 
/* From Uiverse.io by zeeshan_2112 */ 
.offer-card {
  --bg-color: #0b0c10;
  --bg-color-light: #12141a;
  --bg-hover: #1a1c23;
  --border-color: rgba(255, 255, 255, 0.05);
  --border-hover: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-secondary: #9496a8;
  --accent-primary: #8b5cf6;
  --accent-primary-rgb: 139, 92, 246;
  --accent-bg: #1f143d;

  width: 100%;
  max-width: 240px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  padding: 1.25em;
  font-size: 10px;
  font-family: "Inter", "Segoe UI", Roboto, sans-serif;
  color: var(--text-primary);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
  box-sizing: border-sizing;
}

.offer-card * {
  box-sizing: border-box;
}

/* Left glow effect */
.offer-card::before {
  content: "";
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -40px;
  width: 60px;
  height: 50%;
  background: var(--accent-primary);
  filter: blur(60px);
  z-index: 0;
  opacity: 0.12;
  pointer-events: none;
}

.offer-card > * {
  position: relative;
  z-index: 1;
}

/* Progress Bar */
.offer-card__progress {
  display: flex;
  justify-content: center;
  gap: 0.4em;
  margin-bottom: 2em;
}

.offer-card__progress-step {
  width: 2.2em;
  height: 0.25em;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 1em;
  transition: all 0.3s ease;
}

.offer-card__progress-step--active {
  background: var(--accent-primary);
  box-shadow: 0 0 10px rgba(var(--accent-primary-rgb), 0.5);
}

/* Header */
.offer-card__header {
  text-align: center;
  margin-bottom: 2.5em;
}

.offer-card__icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1em;
}

.offer-card__title {
  margin: 0 0 0.3em 0;
  font-size: 1.35em;
  font-weight: 600;
}

.offer-card__subtitle {
  margin: 0;
  font-size: 0.9em;
  color: var(--text-secondary);
  line-height: 1.4;
  padding: 0 0.5em;
}

/* Options */
.offer-card__options {
  display: flex;
  flex-direction: column;
  gap: 0.8em;
  margin-bottom: 2.5em;
}

.offer-card__option {
  cursor: pointer;
  display: block;
  user-select: none;
  position: relative;
}

.offer-card__option-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.offer-card__option-content {
  display: flex;
  align-items: center;
  padding: 0.8em 1.2em;
  background: var(--bg-color-light);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  transition: all 0.25s ease;
}

.offer-card__option-input:hover + .offer-card__option-content {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.offer-card__option-input:focus-visible + .offer-card__option-content {
  box-shadow: 0 0 0 2px var(--accent-primary);
}

.offer-card__option-input:active + .offer-card__option-content {
  transform: scale(0.98);
}

.offer-card__option-input:checked + .offer-card__option-content {
  border-color: rgba(var(--accent-primary-rgb), 0.4);
  background: rgba(var(--accent-primary-rgb), 0.1);
}

/* Icon Wrapper inside option */
.offer-card__option-icon-wrapper {
  width: 2.8em;
  height: 2.8em;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  color: var(--accent-primary);
  margin-right: 1.2em;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.offer-card__option-icon-wrapper svg {
  width: 1.3em;
  height: 1.3em;
}

.offer-card__option-text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.offer-card__option-title {
  font-weight: 500;
  font-size: 1em;
}

.offer-card__option-desc {
  font-size: 0.8em;
  color: var(--text-secondary);
}

/* Right arrow inside option */
.offer-card__option-arrow {
  width: 2.2em;
  height: 2.2em;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.offer-card__option-arrow svg {
  width: 1em;
  height: 1em;
}

.offer-card__option-input:checked
  + .offer-card__option-content
  .offer-card__option-arrow {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.offer-card__option-input:hover
  + .offer-card__option-content
  .offer-card__option-arrow {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

/* Footer */
.offer-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.offer-card__btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  padding: 0.5em 1em 0.5em 0.5em;
  border-radius: 2em;
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.6em;
  transition: all 0.3s ease;
  font-family: inherit;
}

.offer-card__btn--skip {
  padding: 0.5em 0.5em 0.5em 1em;
}

.offer-card__btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.offer-card__btn:focus-visible {
  box-shadow: 0 0 0 2px var(--accent-primary);
  outline: none;
}

.offer-card__btn:active {
  transform: scale(0.96);
}

.offer-card__btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  width: 2.2em;
  height: 2.2em;
  border-radius: 10px;
  color: inherit;
}

.offer-card__btn-icon svg {
  width: 1.1em;
  height: 1.1em;
}

/* Folder specific */
.folder-svg {
  width: 72px;
  height: 72px;
  filter: drop-shadow(0 15px 20px rgba(0, 0, 0, 0.5));
}


# ДЛЯ ЗАГРУЗКИ КОГДА ГРУЗИТ СТРАНИЧКА 
/* From Uiverse.io by RaspberryBee */ 
.loading svg polyline {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.loading svg polyline#back {
  fill: none;
}

.loading svg polyline#front {
  fill: none;
  stroke: #FF0000;
  stroke-dasharray: 48, 144;
  stroke-dashoffset: 192;
  animation: dash_682 1.4s linear infinite;
}

@keyframes dash_682 {
  72.5% {
    opacity: 0;
  }

  to {
    stroke-dashoffset: 0;
  }
}


# Обязательная анимация для карточки роли игрока, когда нажимаешь - переворачивается, сюда нужно будет подставить изображение из файла img. ТУТ ВАЖНА ИМЕННО АНИМАЦИЯ ПЕРЕВОРОТА И ПЛАВНОСТЬ ПРИ НАЖАТИИ А НЕ САМ СТИЛЬ. ТАК КАК ДОЛЖНО БЫТЬ ИЗОБРАЖЕНИЕ НА ОБОИХ СТОРОНАХ КАРТОЧКИ (ЗАДНЯЯ КАРТНКА, И КАРТИНКА С РОЛЬЮ)
/* From Uiverse.io by ElSombrero2 */ 
.card {
  overflow: visible;
  width: 190px;
  height: 254px;
}

.content {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 300ms;
  box-shadow: 0px 0px 10px 1px #000000ee;
  border-radius: 5px;
}

.front, .back {
  background-color: #151515;
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 5px;
  overflow: hidden;
}

.back {
  width: 100%;
  height: 100%;
  justify-content: center;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.back::before {
  position: absolute;
  content: ' ';
  display: block;
  width: 160px;
  height: 160%;
  background: linear-gradient(90deg, transparent, #ff9966, #ff9966, #ff9966, #ff9966, transparent);
  animation: rotation_481 5000ms infinite linear;
}

.back-content {
  position: absolute;
  width: 99%;
  height: 99%;
  background-color: #151515;
  border-radius: 5px;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 30px;
}

.card:hover .content {
  transform: rotateY(180deg);
}

@keyframes rotation_481 {
  0% {
    transform: rotateZ(0deg);
  }

  0% {
    transform: rotateZ(360deg);
  }
}

.front {
  transform: rotateY(180deg);
  color: white;
}

.front .front-content {
  position: absolute;
  width: 100%;
  height: 100%;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.front-content .badge {
  background-color: #00000055;
  padding: 2px 10px;
  border-radius: 10px;
  backdrop-filter: blur(2px);
  width: fit-content;
}

.description {
  box-shadow: 0px 0px 10px 5px #00000088;
  width: 100%;
  padding: 10px;
  background-color: #00000099;
  backdrop-filter: blur(5px);
  border-radius: 5px;
}

.title {
  font-size: 11px;
  max-width: 100%;
  display: flex;
  justify-content: space-between;
}

.title p {
  width: 50%;
}

.card-footer {
  color: #ffffff88;
  margin-top: 5px;
  font-size: 8px;
}

.front .img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background-color: #ffbb66;
  position: relative;
  filter: blur(15px);
  animation: floating 2600ms infinite linear;
}

#bottom {
  background-color: #ff8866;
  left: 50px;
  top: 0px;
  width: 150px;
  height: 150px;
  animation-delay: -800ms;
}

#right {
  background-color: #ff2233;
  left: 160px;
  top: -80px;
  width: 30px;
  height: 30px;
  animation-delay: -1800ms;
}

@keyframes floating {
  0% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(10px);
  }

  100% {
    transform: translateY(0px);
  }
}

# КНОПКА ВОЙТИ ТОЛЬКО НА СТРАНИЦЕ РЕГИСТРАЦИИ и АВТОРИЗАЦИИ  (В КРАСНОМ ЦВЕТЕ)
<!-- From Uiverse.io by S4tyendra --> 
<div class="flex items-center justify-center h-screen">
  <div class="relative group">
    <button
      class="relative inline-block p-px font-semibold leading-6 text-white bg-neutral-900 shadow-2xl cursor-pointer rounded-2xl shadow-emerald-900 transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 hover:shadow-emerald-600"
    >
      <span
        class="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-600 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      ></span>
      <span class="relative z-10 block px-6 py-3 rounded-2xl bg-neutral-950">
        <div class="relative z-10 flex items-center space-x-3">
          <span
            class="transition-all duration-500 group-hover:translate-x-1.5 group-hover:text-emerald-300"
            >Begin Journey</span
          >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-7 h-7 transition-all duration-500 group-hover:translate-x-1.5 group-hover:text-emerald-300"
          >
            <path
              d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"
            ></path>
          </svg>
        </div>
      </span>
    </button>
  </div>
</div>


# КНОПКА ДЛЯ + в найстроках или еще где то (В КРАСНОМ ЦВЕТЕ) 
<!-- From Uiverse.io by catraco --> 
<button
  title="Add New"
  class="group cursor-pointer outline-none hover:rotate-90 duration-300"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="50px"
    height="50px"
    viewBox="0 0 24 24"
    class="stroke-purple-400 fill-none group-hover:fill-purple-800 group-active:stroke-purple-200 group-active:fill-purple-600 group-active:duration-0 duration-300"
  >
    <path
      d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
      stroke-width="1.5"
    ></path>
    <path d="M8 12H16" stroke-width="1.5"></path>
    <path d="M12 16V8" stroke-width="1.5"></path>
  </svg>
</button>


# RADIO button - ДЛЯ ВЫБОРА ПАРАМЕТРОВ В НАСТРОЙКАХ 
/* From Uiverse.io by Praashoo7 */ 
.radio-input {
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-input input {
  appearance: none;
  width: 2em;
  height: 2em;
  background-color: #171717;
  box-shadow: inset 2px 5px 10px rgb(5, 5, 5);
  border-radius: 5px;
  transition: .4s ease-in-out;
}

.radio-input input:hover {
  scale: 1.2;
  cursor: pointer;
  box-shadow: none;
}

.radio-input .plus1 {
  position: relative;
  top: 0.01em;
  left: -1.45em;
  width: 1.3em;
  height: 0.2em;
  background-color: red;
  rotate: 45deg;
  scale: 0;
  border-radius: 5px;
  transition: .4s ease-in-out;
}

.radio-input .plus2 {
  position: relative;
  width: 1.3em;
  height: 0.2em;
  background-color: red;
  transform: rotate(90deg);
  border-radius: 5px;
  transition: .4s ease-in-out;
}

.radio-input input:checked {
  box-shadow: none;
}

.radio-input input:checked + .plus1 {
  transform: rotate(180deg);
  scale: 1;
}

# Можно исползовать в боковой панели 
/* From Uiverse.io by june7011 */ 
.radio-container {
  --main-color: #9f3dff;
  --main-color-opacity: #9f3dff1c;

  /* change this according inputs count */
  --total-radio: 3;

  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 0.5rem;
}
.radio-container input {
  cursor: pointer;
  appearance: none;
}
.radio-container .glider-container {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(
    0deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(27, 27, 27, 1) 50%,
    rgba(0, 0, 0, 0) 100%
  );
  width: 1px;
}
.radio-container .glider-container .glider {
  position: relative;
  height: calc(100% / var(--total-radio));
  width: 100%;
  background: linear-gradient(
    0deg,
    rgba(0, 0, 0, 0) 0%,
    var(--main-color) 50%,
    rgba(0, 0, 0, 0) 100%
  );
  transition: transform 0.5s cubic-bezier(0.37, 1.95, 0.66, 0.56);
}
.radio-container .glider-container .glider::before {
  content: "";
  position: absolute;
  height: 60%;
  width: 300%;
  top: 50%;
  transform: translateY(-50%);
  background: var(--main-color);
  filter: blur(10px);
}
.radio-container .glider-container .glider::after {
  content: "";
  position: absolute;
  left: 0;
  height: 100%;
  width: 150px;
  background: linear-gradient(
    90deg,
    var(--main-color-opacity) 0%,
    rgba(0, 0, 0, 0) 100%
  );
}
.radio-container label {
  cursor: pointer;
  padding: 1rem;
  position: relative;
  color: grey;
  transition: all 0.3s ease-in-out;
}

.radio-container input:checked + label {
  color: var(--main-color);
}

.radio-container input:nth-of-type(1):checked ~ .glider-container .glider {
  transform: translateY(0);
}

.radio-container input:nth-of-type(2):checked ~ .glider-container .glider {
  transform: translateY(100%);
}

.radio-container input:nth-of-type(3):checked ~ .glider-container .glider {
  transform: translateY(200%);
}

.radio-container input:nth-of-type(4):checked ~ .glider-container .glider {
  transform: translateY(300%);
}

.radio-container input:nth-of-type(5):checked ~ .glider-container .glider {
  transform: translateY(400%);
}

.radio-container input:nth-of-type(6):checked ~ .glider-container .glider {
  transform: translateY(500%);
}

.radio-container input:nth-of-type(7):checked ~ .glider-container .glider {
  transform: translateY(600%);
}

.radio-container input:nth-of-type(8):checked ~ .glider-container .glider {
  transform: translateY(700%);
}

.radio-container input:nth-of-type(9):checked ~ .glider-container .glider {
  transform: translateY(800%);
}

.radio-container input:nth-of-type(10):checked ~ .glider-container .glider {
  transform: translateY(900%);
}

