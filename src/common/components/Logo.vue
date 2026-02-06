<template>
  <RouterLink
    id="logo"
    to="/"
  >
    <span class="logotype">
      <span class="frontface"></span>
      <span class="backface">
        <svg
          class="fill-accent"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 12 12"
        >
          <path
            d="M0 5.333a2 2 0 0 1 .72-1.536l4-3.333a2 2 0 0 1 2.56 0l4 3.333A2 2 0 0 1 12 5.333v5.064a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V5.333Z"
          />
        </svg>
      </span>
    </span>
    <svg
      class="logomark fill-neutral-950 max-md:hidden dark:fill-neutral-50"
      xmlns="http://www.w3.org/2000/svg"
      width="84"
      height="25"
    >
      <path
        d="M0 24.14h3.719v-8.644c0-3.295 1.925-5.415 4.7-5.415 2.577 0 4.143 1.859 4.143 4.828v9.231h3.719v-9.59c0-4.795-2.707-7.861-7.176-7.861a7.5 7.5 0 0 0-5.806 2.479l-.391-2.055H0V24.14Zm28.607.424c5.382 0 9.2-3.686 9.2-8.938 0-5.219-3.816-8.938-9.2-8.938-5.415 0-9.231 3.719-9.231 8.938 0 5.25 3.816 8.936 9.231 8.936v.002Zm-5.545-8.938a5.309 5.309 0 0 1 5.545-5.545 5.299 5.299 0 0 1 5.513 5.545 5.3 5.3 0 0 1-5.513 5.545 5.308 5.308 0 0 1-5.545-5.547v.002Zm18.2 8.514h3.719V0h-3.718l-.001 24.14Zm15.2.424a7.25 7.25 0 0 0 5.708-2.479l.424 2.055h2.9V7.111H61.78v8.644c0 3.295-1.892 5.415-4.632 5.415-2.544 0-4.077-1.859-4.077-4.828V7.111h-3.719v9.59c0 4.795 2.642 7.861 7.111 7.861l-.001.002Zm20.126 0c4.338 0 7.111-1.957 7.111-5.023 0-2.74-2.185-4.567-6.459-5.382-3.262-.652-4.273-1.24-4.273-2.446 0-1.272 1.174-2.022 3.164-2.022 2.185 0 3.49.881 3.621 2.446h3.653c-.228-3.458-2.9-5.447-7.274-5.447-4.306 0-6.817 1.827-6.817 4.991 0 2.773 2.022 4.436 6.393 5.154 3 .522 4.338 1.337 4.338 2.642 0 1.272-1.272 2.022-3.425 2.022-2.446 0-3.914-1.044-3.979-2.773h-3.652c0 3.52 3.033 5.836 7.6 5.836l-.001.002Z"
      />
    </svg>
  </RouterLink>
</template>

<style scoped lang="scss">
html {
  #logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    z-index: 1;
    transition: transform 0.1s ease-out;
  }

  .logotype {
    transform-style: preserve-3d;
    transition: transform 0.3s ease-out;
    display: grid;

    .frontface,
    .backface {
      width: 32px;
      height: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      backface-visibility: hidden;
      border-radius: 50%;
      background-color: var(--color-brand-accent);
      grid-area: 1 / 1;
      border: 2px solid transparent;
    }

    .frontface::after {
      content: " ";
      display: block;
      width: 16px;
      height: 16px;
      background-color: var(--color-background-level-2);
      border-radius: 15%;
    }

    .backface {
      background-color: var(--color-background-level-2);
      border-color: var(--color-brand-accent);
      transform: rotateY(180deg);
    }
  }

  #logo:hover .logotype {
    transform: rotateY(180deg);
  }
  #logo:active {
    transform: scale(0.95);
  }

  .logomark {
    transform: translateY(-3px);
  }
}
</style>
