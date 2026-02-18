<template>
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    class="sidebar-icon"
  >
    <g v-if="icon === 'leases'">
      <circle
        cx="7"
        cy="17"
        r="5"
        class="stroke fill-neutral-bg-2 transition group-[.router-link-active]:translate-x-[45%] group-[.router-link-active]:translate-y-[-45%] group-[.router-link-active]:fill-icon-link"
      />
      <g
        class="transition group-[.router-link-active]:translate-x-[-25%] group-[.router-link-active]:translate-y-[25%]"
      >
        <circle
          cx="12"
          cy="12"
          r="7"
          class="stroke-neutral-bg-2 stroke-[3px] opacity-0 group-[.router-link-active]:opacity-100"
        />
        <circle
          cx="12"
          cy="12"
          r="5"
          class="stroke fill-neutral-bg-2 group-[.router-link-active]:fill-icon-link"
        />
      </g>
      <path
        d="M16 2H22V8"
        class="stroke fill-transparent"
      />
    </g>
    <g v-else-if="icon === 'assets'">
      <circle
        cx="8"
        cy="12"
        r="7"
        class="stroke translate-x-0 fill-neutral-bg-2 transition group-[.router-link-active]:translate-x-2/4 group-[.router-link-active]:fill-icon-link"
      />
      <g class="translate-x-0 transition group-[.router-link-active]:translate-x-[calc(-50%+2px)]">
        <circle
          cx="16"
          cy="12"
          r="7"
          class="fill-transparent stroke-neutral-bg-2 stroke-[5px]"
        />
        <circle
          cx="16"
          cy="12"
          r="7"
          class="stroke fill-neutral-bg-2 group-[.router-link-active]:fill-icon-link"
        />
      </g>
    </g>
    <g v-else-if="icon === 'earn'">
      <g class="transition group-[.router-link-active]:rotate-[360deg]">
        <circle
          class="stroke fill-transparent group-[.router-link-active]:fill-icon-link"
          cx="11"
          cy="9"
          r="8"
        />
        <path
          class="stroke stroke-on-bg"
          d="M8 8L11 11C12 10 13 9 14 8"
        />
      </g>
      <line
        class="stroke scale-x-100 stroke-icon-default opacity-100 transition group-[.router-link-active]:scale-0 group-[.router-link-active]:opacity-0"
        x1="2"
        x2="20"
        y1="21"
        y2="21"
      />
      <line
        class="stroke scale-x-0 stroke-icon-link opacity-0 transition group-[.router-link-active]:scale-100 group-[.router-link-active]:opacity-100"
        x1="2"
        x2="20"
        y1="21"
        y2="21"
      />
    </g>
    <g
      v-else-if="icon === 'stake'"
      class="animate-shake"
    >
      <path
        class="stroke fill-transparent group-[.router-link-active]:fill-icon-link"
        d="M9 15.68v1a1 1 0 0 1-1 1H5.977A.977.977 0 0 1 5 16.703v-.61c0-.905-.36-1.773-1-2.413l-.046-.047a3.256 3.256 0 0 0-2.303-.953.651.651 0 0 1-.651-.652V8.256c0-.318.258-.576.576-.576.873 0 1.67-.493 2.06-1.274l.131-.261A6.94 6.94 0 0 0 4.5 3.041V1.975c0-.655.623-1.14 1.239-.914 1.297.476 1.979 1.035 2.645 1.83.405.482.987.789 1.617.789H13c2 0 6 1.5 6 6 0 3-2 4-2 5v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1Z"
      />
      <path
        class="stroke"
        d="M18.25 12.5a2.5 2.5 0 0 0 3.6-3"
        fill="none"
      />
      <circle
        class="animate-blink fill-icon-default group-[.router-link-active]:fill-neutral-bg-2"
        cx="8.25"
        cy="8.25"
        r="1.5"
      />
    </g>
    <g v-else-if="icon === 'history'">
      <path
        d="M12 12V8"
        class="stroke"
      />
      <path
        d="M12 12L15 15"
        class="stroke transition-long transition group-[.router-link-active]:rotate-[-360deg]"
        style="transform-origin: 0 0; transform-box: fill-box"
      />
      <g class="transition-long transition group-[.router-link-active]:-rotate-[360deg]">
        <path
          d="M3.51213 9C4.74764 5.50442 8.08135 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.97415 21 4.56567 18.3567 3.41547 14.7109"
          class="stroke fill-transparent"
        />
        <path
          d="M3 5V9H7"
          class="stroke fill-transparent"
        />
      </g>
    </g>
    <g v-else-if="icon === 'vote'" class="animate-shake">
      <path 
        d="M5 18V12.5V9L9 1H10C10.5 1 11.7386 1.82956 11.5 3.5L11 7H16.0631C17.8811 7 19.2813 8.60405 19.0356 10.4053L18.3538 15.4053C18.1511 16.8918 16.8815 18 15.3813 18L5 18Z"
        class="stroke fill-transparent group-[.router-link-active]:fill-icon-link"
      />
      <path 
        d="M1 10C1 9.44772 1.44772 9 2 9H5V18H2C1.44772 18 1 17.5523 1 17V10Z"
        class="stroke fill-transparent"
      />
    </g>
    <g v-else-if="icon === 'stats'">
      <rect 
        x="2"
        y="20%"
        
        width="5"
        height="75%"
        class="fill-icon-default transition group-[.router-link-active]:fill-icon-link
        !origin-bottom scale-y-50 group-[.router-link-active]:scale-y-100
        "
      />
      <rect 
        x="9"
        y="20%"
        
        width="5"
        height="75%"
        class="fill-icon-default transition group-[.router-link-active]:fill-icon-link
        !origin-bottom scale-y-100 group-[.router-link-active]:scale-y-75"
      />
      <rect 
        x="16"
        y="20%"
        
        width="5"
        height="75%"
        class="fill-icon-default transition group-[.router-link-active]:fill-icon-link  !origin-bottom scale-y-75 group-[.router-link-active]:scale-y-50"
      />
    </g>
  </svg>
</template>

<script lang="ts" setup>
defineProps<{
  icon?: string;
  toggled?: boolean;
}>();
</script>

<style scoped lang="scss">
.sidebar-icon {
  @apply transform-gpu;
  --sidebar-icon-transition-duration-short: 0.2s;
  --sidebar-icon-transition-duration-base: 0.35s;
  --sidebar-icon-transition-duration-long: 0.55s;
  --sidebar-icon-transition-timing-default: cubic-bezier(0, 0.39, 0.32, 0.97);
  --sidebar-icon-transition-timing-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  .stroke,
  .stroke-on-bg {
    @apply stroke-icon-default;
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: all var(--sidebar-icon-transition-duration-base) var(--sidebar-icon-transition-timing-default);
  }
  .stroke-on-bg {
    stroke: var(--color-icon-default);
    fill: transparent;
  }

  // Animations
  .transition {
    transition: all var(--sidebar-icon-transition-duration-base) var(--sidebar-icon-transition-timing-default);
    transform-origin: center;
    transform-box: border-box;
  }
  .transition-short {
    transition-duration: var(--sidebar-icon-transition-duration-short);
  }
  .transition-long {
    transition-duration: var(--sidebar-icon-transition-duration-long);
  }
  .transition-spring {
    transition-timing-function: var(--sidebar-icon-transition-timing-spring);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-icon {
    .transition,
    .animate-shake,
    .animate-blink {
      transition: none !important;
      animation: none !important;
    }
  }
}

.router-link-active .sidebar-icon {
  .stroke {
    @apply stroke-icon-link;
  }
  .stroke-on-bg {
    @apply stroke-neutral-bg-2;
  }

  // Animations
  .animate-shake {
    animation: shake 0.5s ease-out;
    transform-origin: center;
  }
  .animate-blink {
    animation: blink 7s linear 3s infinite;
    transform-origin: center;
    transform-box: border-box;
  }
}

@keyframes shake {
  0% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-8deg);
  }
  40% {
    transform: rotate(8deg);
  }
  60% {
    transform: rotate(-8deg);
  }
  80% {
    transform: rotate(8deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes blink {
  0% {
    transform: scaleY(1);
  }
  2.5% {
    transform: scaleY(0.1);
  }
  5% {
    transform: scaleY(1);
  }
  100% {
    transform: scaleY(1);
  }
}
</style>
