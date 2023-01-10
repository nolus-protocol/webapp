<template>
  <div class="container w-full grid grid-cols-12 mx-auto grid-parent">
    <div class="lg:col-span-3">
      <div class="sidebar-container">
        <div class="top">
          <LogoLink link="/"></LogoLink>

          <div class="sidebar-elements-container block p-8 pr-0">
            <div class="block">
              <SidebarElement
                id="assets"
                icon="@/assets/icons/assets.svg"
                iconHover="@/assets/icons/assets_active.svg"
                :isActive="true"
                href="#typography_and_colors"
                label="T&C"
                @click.stop=""
              >
              </SidebarElement>
            </div>
            <div class="block">
              <SidebarElement
                id="lease"
                icon="@/assets/icons/lease.svg"
                iconHover="@/assets/icons/lease_active.svg"
                href="#buttons"
                label="Buttons"
                @click.stop=""
              >
              </SidebarElement>
            </div>
            <div class="block">
              <SidebarElement
                id="trade"
                icon="@/assets/icons/trade.svg"
                iconHover="@/assets/icons/trade_active.svg"
                href="#form-template"
                label="Form"
              >
              </SidebarElement>
            </div>
            <div class="block">
              <SidebarElement
                id="earn"
                icon="@/assets/icons/earn.svg"
                iconHover="@/assets/icons/earn_active.svg"
                href="#header"
                label="Headers"
                @click.stop=""
              >
              </SidebarElement>
            </div>
            <div class="block">
              <SidebarElement
                id="history"
                icon="@/assets/icons/history.svg"
                iconHover="@/assets/icons/history_active.svg"
                href="#icons"
                label="Icons"
                @click.stop=""
              >
              </SidebarElement>
            </div>
            <div class="block">
              <SidebarElement
                id="history"
                icon="@/assets/icons/history.svg"
                iconHover="@/assets/icons/history_active.svg"
                href="#snackbar"
                label="S&T"
                @click.stop=""
              >
              </SidebarElement>
            </div>

            <div class="block">
              <SidebarElement
                id="history"
                icon="@/assets/icons/history.svg"
                iconHover="@/assets/icons/history_active.svg"
                href="#modals"
                label="Modals"
                @click.stop=""
              >
              </SidebarElement>
            </div>

            <div class="block">
              <SidebarElement
                id="history"
                icon="@/assets/icons/history.svg"
                iconHover="@/assets/icons/history_active.svg"
                href="#history"
                label="History"
                @click.stop=""
              >
              </SidebarElement>
            </div>
          </div>
        </div>
        <div class="bot px-8 pb-8">
          <div class="flex items-center">
            <SidebarSocialElement
              id="twitter"
              :href="TWITTER_ACCOUNT"
              icon="@/assets/icons/twitter.svg"
            >
            </SidebarSocialElement>
            <SidebarSocialElement
              id="telegram"
              :href="TELEGRAM_ACCOUNT"
              icon="@/assets/icons/telegram.svg"
            >
            </SidebarSocialElement>
            <SidebarSocialElement
              id="discord"
              :href="DISCORD_ACCOUNT"
              icon="@/assets/icons/discord.svg"
            >
            </SidebarSocialElement>
            <SidebarSocialElement
              id="redit"
              :href="REDDIT_ACCOUNT"
              icon="@/assets/icons/reddit.svg"
            >
            </SidebarSocialElement>
            <SidebarSocialElement
              id="medium"
              :href="MEDIUM_ACCOUNT"
              icon="@/assets/icons/medium.svg"
            >
            </SidebarSocialElement>
          </div>
          <div class="block mt-3">
            <SidebarLinkElement
              id="term-of-service"
              href="#"
              label="Terms of Service"
            >
            </SidebarLinkElement>
          </div>
        </div>
      </div>
    </div>
    <div class="lg:col-span-9 pb-8">
      <div class="grid grid-cols-10 grid-child">
        <div class="sidebar-header">
          <SidebarHeader />
        </div>

        <!-- TYPOGRAPHY & COLORS -->
        <div id="typography_and_colors" class="col-span-12">
          <div id="color-pallette" class="grid grid-cols-12 gap-6 pt-8">
            <div class="col-span-6">
              <h1 class="text nls-font-700 nls-32 text-primary">
                Typography & color
              </h1>
              <p class="nls-48 nls-font-700 text-primary mt-8">
                48/1.1 - Big number
              </p>
              <p class="nls-40 nls-font-700 text-primary mt-8">
                40/1.1 - Big number
              </p>
              <p class="nls-32 nls-font-700 text-primary mt-8">
                32/1.1 - Large heading
              </p>
              <p class="nls-20 nls-font-700 text-primary mt-8">
                20/1.2 - Default Heading
              </p>
              <p class="nls-18 nls-font-700 text-primary mt-8">
                18/1.2 - Small Heading
              </p>
              <div class="flex items-center mt-8">
                <p class="nls-16 nls-500 text-primary mr-4">
                  16/1.4 - Large copy
                </p>

                <p class="nls-16 nls-500 text-primary mr-4">Medium</p>
                <p class="nls-16 nls-700 text-primary">Bold</p>
              </div>
              <div class="flex items-center mt-8">
                <p class="nls-14 nls-font-400 text-primary mr-4">
                  14/1.4 - Normal copy
                </p>
                <p class="nls-14 nls-font-500 text-primary mr-4">Medium</p>
                <p class="nls-14 nls-font-700 text-primary">Bold</p>
              </div>
              <div class="flex items-center mt-8">
                <p class="nls-13 nls-font-400 mr-4 color-light-blue">
                  13/1.3 - Small copy
                </p>
                <p class="nls-13 nls-font-500 mr-4 color-light-blue">Medium</p>
                <p class="nls-13 nls-font-700 color-light-blue">Bold</p>
              </div>

              <p class="nls-12 nls-font-500 mt-8 color-light-blue">
                12/1.2 - Detail
              </p>
            </div>
            <div class="col-span-6">
              <h1 class="text nls-font-700 nls-32">Colors</h1>
              <p class="text nls-20 nls-font-700 mt-8">
                <span class="flex items-center justify-between">
                  <span> Neutrals background scale </span>
                  <span class="text nls-14 nls-font-400"> Dark mode </span>
                </span>
              </p>
              <div class="flex flex-row justify-between mt-[25px]">
                <div class="flex">
                  <div
                    class="d-inline-block w-[81px] h-[81px] backgroundGrey"
                  ></div>
                  <div class="d-inline-block w-[81px] h-[81px] bg-grey"></div>
                  <div
                    class="d-inline-block w-[81px] h-[81px] bg-grey-dark"
                  ></div>
                </div>
                <div class="d-inline-block w-[81px] h-[81px] bg-dark"></div>
              </div>

              <p class="text nls-20 nls-font-700 mt-8">
                Neutral typography scale
              </p>
              <div class="flex flex-row mt-[25px]">
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-light-blue"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-medium-blue"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-dark-blue"
                ></div>
              </div>

              <p class="text nls-20 nls-font-700 mt-8">CTA color scale</p>
              <div class="flex flex-row mt-[25px]">
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-light-electric"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-medium-electric"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-dark-electric"
                ></div>
              </div>

              <p class="text nls-20 nls-font-700 mt-8">CTA color scale</p>
              <div class="flex flex-row mt-[25px]">
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-light-red"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-medium-red"
                ></div>
                <div class="d-inline-block w-[81px] h-[81px] bg-dark-red"></div>
              </div>

              <p class="text nls-20 nls-font-700 mt-8">CTA color scale</p>
              <div class="flex flex-row mt-[25px]">
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-light-green"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-medium-green"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-dark-green"
                ></div>
              </div>

              <p class="text nls-20 nls-font-700 mt-8">Warning scale</p>
              <div class="flex flex-row mt-[25px]">
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-light-yellow"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-medium-yellow"
                ></div>
                <div
                  class="d-inline-block w-[81px] h-[81px] bg-dark-yellow"
                ></div>
              </div>

              <p class="text nls-20 nls-font-700 mt-8">Brand accent</p>
              <div class="flex flex-row mt-[25px]">
                <div class="d-inline-block w-[81px] h-[81px] bg-orange"></div>
              </div>
            </div>
          </div>
        </div>
        <!-- /TYPOGRAPHY & COLORS -->

        <!-- BUTTONS -->
        <div id="buttons" class="col-span-12">
          <!-- Buttons -->
          <div class="">
            <h1 class="text nls-font-700 nls-32">Buttons</h1>

            <!-- Large - Primary -->
            <h2 class="text nls-20 nls-font-700 mt-6">Large - Primary</h2>
            <div class="flex flex-wrap mt-[25px]">
              <button
                class="btn btn-primary btn-large-primary mr-4"
                style="--anim-index: 0"
              >
                Buy Tokens
              </button>
              <button class="btn btn-primary btn-large-primary disabled mr-4">
                Buy Tokens
              </button>
              <button class="btn btn-primary btn-large-primary js-loading mr-4">
                Buy Tokens
              </button>
            </div>

            <!-- Large - Secondary -->
            <h2 class="text nls-20 nls-font-700 mt-6">Large - Secondary</h2>
            <div class="flex mt-[25px]">
              <button class="btn btn-secondary btn-large-secondary mr-4">
                Buy Tokens
              </button>
              <!-- <button class="btn btn-secondary btn-large-secondary js-loading">
                Buy Tokens
              </button> -->
            </div>

            <!-- Large - Boxes -->
            <h2 class="text nls-20 nls-font-700 mt-6">Large - Boxes</h2>
            <div class="grid grid-cols-4 gap-4 mt-[25px]">
              <button class="btn btn-box btn-large-box mr-4 basis-0 grow">
                <span class="icon icon-google"></span> Sign In With Google
              </button>

              <!-- <button class="btn btn-box btn-large-box js-loading mt-[25px]">
                Buy Tokens
              </button> -->
            </div>

            <!-- Medium - Secondary -->
            <h2 class="text nls-20 nls-font-700 mt-6">Medium - Secondary</h2>
            <div class="flex mt-[25px]">
              <button class="btn btn-secondary btn-medium-secondary mr-4">
                None
              </button>

              <button
                class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
              >
                None
              </button>
              <button
                class="btn btn-secondary btn-medium-secondary btn-emphatized success mr-4"
              >
                None
              </button>
            </div>

            <!-- Medium - Secondary + Icon -->
            <h2 class="text nls-20 nls-font-700 mt-6">
              Medium - Secondary + Icon
            </h2>
            <div class="flex mt-[25px]">
              <button
                class="btn btn-secondary btn-medium-secondary btn-icon flex mr-4"
              >
                <span class="icon w-4 h-4 icon-copy"></span>
                <span>Copy</span>
              </button>

              <button
                class="btn btn-secondary btn-medium-secondary btn-icon flex btn-emphatized mr-4"
              >
                <span class="icon w-4 h-4 icon-copy"></span>
                <span>Copy</span>
              </button>
              <button
                class="btn btn-secondary btn-medium-secondary btn-emphatized flex success btn-icon mr-4"
              >
                <span class="icon w-4 h-4 icon-copy"></span>
                <span>Copy</span>
              </button>
            </div>
            <!-- Small - Secondary -->
            <h2 class="text nls-20 nls-font-700 mt-6">Small - Secondary</h2>
            <div class="flex mt-[25px]">
              <button class="btn btn-secondary btn-small-secondary flex mr-4">
                <span>Copy</span>
              </button>
              <button
                class="btn btn-secondary btn-small-secondary flex js-loading mr-4"
              >
                <span>Copy</span>
              </button>
              <button
                class="btn btn-secondary btn-small-secondary flex btn-emphatized mr-4"
              >
                <span>Copy</span>
              </button>
              <button
                class="btn btn-secondary btn-small-secondary btn-emphatized flex success mr-4"
              >
                <span>Copy</span>
              </button>
              <button
                class="btn btn-secondary btn-small-secondary btn-emphatized flex dark mr-4"
              >
                <span>Nope</span>
              </button>
            </div>

            <!-- Circle on background -->
            <h2 class="text nls-20 nls-font-700 mt-6">Circle on background</h2>
            <div class="inline-flex mt-[25px] p-4 rounded-lg">
              <button class="btn btn-close">
                <span class="icon-close circle"></span>
              </button>
            </div>

            <!-- Header buttons -->
            <h2 class="text nls-20 nls-font-700 mt-6">Header buttons</h2>
            <div class="inline-flex mt-[25px] p-4 rounded-lg">
              <button class="btn btn-header mr-4">
                <BellIcon class="icon w-4 h-4" />
              </button>
              <button class="btn btn-header">
                <BellIcon class="icon w-4 h-4" />
                <span class="counter">8</span>
              </button>
            </div>
          </div>
        </div>
        <!-- /BUTTONS -->

        <!-- HEADERS -->
        <div id="header" class="col-span-12">
          <div class="grid grid-cols-12 gap-6 pt-8">
            <h1 class="text nls-font-700 nls-32">Headers</h1>
          </div>

          <!-- Header -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-12">
              <!-- Header -->
              <div
                class="flex flex-wrap items-center justify-between px-4 lg:px-0"
              >
                <div class="left w-full md:w-1/2">
                  <h1 class="nls-20 nls-font-700 text-primary m-0">Assets</h1>
                </div>
                <div
                  class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end"
                >
                  <button
                    class="btn btn-secondary btn-large-secondary mr-4"
                    @click="showSendModal = true"
                  >
                    Send / Receive
                  </button>
                  <button class="btn btn-primary btn-large-primary">
                    Buy Tokens
                  </button>
                </div>
              </div>
              <!-- Wallet -->
              <div
                class="nolus-box box flex items-center justify-between background mt-6 border-standart shadow-box"
              >
                <div class="left inline-block">
                  <p class="nls-font-500 nls-16 text-primary mb-nolus-6">
                    Wallet Balance
                  </p>
                  <p class="nls-48 nls-font-700 text-primary whitespace-nowrap">
                    $ 123,423.00
                  </p>
                </div>
              </div>
              <!-- Existing Assets -->
              <div
                class="nolus-box block background mt-6 border-standart shadow-box radius-medium radius-0-sm"
              >
                <div class="loader">
                  <div class="loader__element"></div>
                </div>
                <!-- Top -->
                <div
                  class="flex flex-wrap items-baseline justify-between pt-5 px-6"
                >
                  <div class="left w-full md:w-1/2">
                    <p class="nls-16 nls-font-500 m-0">Existing assets</p>
                  </div>
                  <div
                    class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end"
                  >
                    <div class="relative block checkbox-container">
                      <div class="flex items-center w-full justify-end">
                        <input
                          id="hide-small-balances"
                          v-model="hideLowerBalances"
                          aria-describedby="hide-small-balances"
                          name="hide-small-balances"
                          type="checkbox"
                        />
                        <label for="hide-small-balances"
                          >Hide small balances</label
                        >
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Assets -->
                <div class="block mt-6 md:mt-[25px]">
                  <!-- Assets Header -->
                  <div
                    class="grid grid-cols-3 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6"
                  >
                    <div
                      class="nls-font-500 nls-12 text-left text-dark-grey text-upper"
                    >
                      Assets
                    </div>

                    <div
                      class="nls-font-500 nls-12 text-right text-dark-grey text-upper"
                    >
                      Price
                    </div>

                    <div
                      class="inline-flex items-center justify-end nls-font-500 text-dark-grey nls-12 text-right text-upper"
                    >
                      <span class="inline-block">Balance</span>
                      <!-- tooltip-->
                      <div
                        class="relative flex flex-col items-center icon-tooltip group group-tooltip"
                      >
                        <div
                          class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
                        >
                          <span
                            class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
                            >A top aligned tooltip.</span
                          >
                          <div
                            class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
                            style="background: #000; bottom: -4px"
                          ></div>
                        </div>
                      </div>
                      <!-- /tooltip-->
                    </div>

                    <div
                      class="hidden md:inline-flex items-center justify-end nls-font-500 nls-12 text-dark-grey text-right text-upper"
                    >
                      <span class="inline-block">Earnings</span>
                      <!-- tooltip-->
                      <div
                        class="relative flex flex-col items-center icon-tooltip group group-tooltip"
                      >
                        <div
                          class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
                        >
                          <span
                            class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
                            >A top aligned tooltip.</span
                          >
                          <div
                            class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
                            style="background: #000; bottom: -4px"
                          ></div>
                        </div>
                      </div>
                      <!-- /tooltip-->
                    </div>
                  </div>

                  <!-- Assets Container -->
                </div>
              </div>

              <!-- Leases -->
              <div
                class="nolus-box background mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5"
              >
                <div class="flex justify-start">
                  <div
                    class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5"
                  >
                    <div class="flex mb-8">
                      <img
                        src="@/assets/icons/coins/btc.svg"
                        class="inline-block m-0 mr-3"
                        height="36"
                        width="36"
                      />
                      <div class="flex flex-col">
                        <h1
                          class="text-primary nls-font-700 nls-32 whitespace-nowrap"
                        >
                          3.000000
                          <span
                            class="inline-block text-primary nls-16 nls-font-400 nls-14"
                            >BTC</span
                          >
                        </h1>
                        <span class="nls-13 nls-font-400 text-dark-grey"
                          >$111,824.94</span
                        >
                      </div>
                    </div>

                    <div class="block mt-[25px] pl-12 mt-[25px]">
                      <div class="block">
                        <p class="nls-font-400 nls-12 text-primary m-0">
                          Outstanding Loan Amount
                        </p>
                        <p class="text-primary nls-font-500 nls-20 m-0 mt-1">
                          $111,824.94
                        </p>
                      </div>
                      <div class="flex justify-between mt-[25px]">
                        <div class="block">
                          <p class="nls-font-400 nls-12 text-primary m-0">
                            Interest Due
                          </p>
                          <p
                            class="flex items-center text-primary nls-font-500 nls-20 m-0 mt-1"
                          >
                            $824.94
                          </p>
                        </div>
                        <div class="block">
                          <p class="nls-font-400 nls-12 text-primary m-0">
                            Interest Rate
                          </p>
                          <p
                            class="flex items-center text-primary nls-font-500 nls-20 m-0 mt-1"
                          >
                            14.1%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="lg:col-span-2 px-6 pt-5">
                    <!-- Graph -->
                  </div>
                </div>
                <div
                  class="flex items-center justify-end border-t border-standart pt-4 px-6"
                >
                  <button
                    class="btn btn-secondary btn-large-secondary"
                    @click="showRepayModal = true"
                  >
                    Repay
                  </button>
                </div>
              </div>
              <!-- /Leases -->

              <!-- Rewards -->
              <div
                class="nolus-box block order-2 md:order-1 background border-y border-standart radius-medium md:col-span-7 mt-6"
              >
                <div
                  class="flex items-center justify-between px-nolus-24 pt-nolus-24"
                >
                  <h2 class="nls-16 nls-font-500 text-left my-0">
                    Pending rewards
                  </h2>
                  <button class="btn-label btn-large-label">
                    Claim all
                  </button>
                </div>
                <!-- Assets -->
                <div class="block mt-nolus-16">
                  <!-- Assets Container -->
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 border-b border-t border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        cols
                          ? 'grid-cols-' + cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          src="@/assets/icons/coins/btc.svg"
                          class="inline-block m-0 mr-4"
                          height="32"
                          width="32"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            BTC
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end">
                        <button
                          class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                          data-v-37958d79=""
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        cols
                          ? 'grid-cols-' + cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          src="@/assets/icons/coins/btc.svg"
                          class="inline-block m-0 mr-4"
                          height="32"
                          width="32"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            BTC
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end">
                        <button
                          class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                          data-v-37958d79=""
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 border-b border-b border-standart  px-nolus-24 py-nolus-12 items-center justify-between',
                        cols
                          ? 'grid-cols-' + cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          src="@/assets/icons/coins/btc.svg"
                          class="inline-block m-0 mr-4"
                          height="32"
                          width="32"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            BTC
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end">
                        <button
                          class="btn btn-secondary btn-medium-secondary js-loading mr-4"
                          data-v-37958d79=""
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- Assets Container -->
                </div>
              </div>
              <!-- Portfolio -->
              <div
                class="nolus-box block order-2 md:order-1 background border-y border-standart radius-medium md:col-span-7 mt-6"
              >
                <div
                  class="flex items-center justify-between px-nolus-24 px-nolus-24 pt-nolus-24"
                >
                  <h2 class="nls-16 nls-font-500 text-left my-0">
                    Your earning portfolio
                  </h2>
                  <button class="btn-label btn-large-label">
                    View all earning assets
                  </button>
                </div>
                <!-- Assets -->
                <div class="block mt-6 md:mt-[25px]">
                  <!-- Assets Header -->
                  <div
                    class="grid grid-cols-2 gap-6 border-b border-standart pb-3 px-6"
                  >
                    <div
                      class="nls-font-500 nls-12 text-dark-grey text-left text-upper"
                    >
                      Asset
                    </div>

                    <div
                      class="inline-flex items-center justify-end nls-font-500 nls-font-500 nls-12 text-dark-grey text-right text-upper"
                    >
                      <span class="inline-block">Current Balance</span>
                    </div>
                  </div>

                  <!-- Assets Container -->
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6 row-actions border-b flex border-t border-standart px-nolus-24 py-nolus-12 items-center justify-between',
                        cols
                          ? 'grid-cols-' + cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          src="@/assets/icons/coins/btc.svg"
                          class="inline-block m-0 mr-4"
                          height="32"
                          width="32"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            BTC
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            $32,430.22
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <!-- Balance -->
                      <div class="block info-show">
                        <p
                          class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                        >
                          $14,978.35
                        </p>
                        <div
                          class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                        >
                          521.21 ATOM
                        </div>
                      </div>
                      <div class="flex justify-end nls-btn-show">
                        <button
                          class="btn btn-secondary btn-medium-secondary"
                          data-v-37958d79=""
                        >
                          Supply / Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6  row-actions border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        cols
                          ? 'grid-cols-' + cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          src="@/assets/icons/coins/nls.svg"
                          class="inline-block m-0 mr-4"
                          height="32"
                          width="32"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            NLS
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            $0.10000
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="block info-show">
                        <p
                          class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                        >
                          $14,978.35
                        </p>
                        <div
                          class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                        >
                          521.21 ATOM
                        </div>
                      </div>

                      <div class="flex justify-end nls-btn-show">
                        <button
                          class="btn btn-secondary btn-medium-secondary"
                          data-v-37958d79=""
                        >
                          Supply / Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="block">
                    <div
                      :class="[
                        'grid gap-6  row-actions border-b border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                        cols
                          ? 'grid-cols-' + cols
                          : 'grid-cols-3 md:grid-cols-4',
                      ]"
                    >
                      <!-- Ticker -->
                      <div class="inline-flex items-center">
                        <img
                          src="@/assets/icons/coins/atom.svg"
                          class="inline-block m-0 mr-4"
                          height="32"
                          width="32"
                        />
                        <div class="inline-block">
                          <p
                            class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                          >
                            ATOM
                          </p>
                          <p
                            class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                          >
                            $28.74
                          </p>
                        </div>
                      </div>

                      <!-- Balance -->
                      <div class="flex justify-end nls-btn-show">
                        <button
                          class="btn btn-secondary btn-medium-secondary"
                          data-v-37958d79=""
                        >
                          Supply / Withdraw
                        </button>
                      </div>
                      <div class="block info-show">
                        <p
                          class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                        >
                          $14,978.35
                        </p>
                        <div
                          class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                        >
                          521.21 ATOM
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Assets Container -->
                </div>
              </div>
              <!-- Portfolio -->

              <!-- all assets -->

              <div
                class="nolus-box block background mt-6 border-standart shadow-box radius-medium radius-0-sm"
              >
                <!-- Top -->
                <div
                  class="flex flex-wrap items-baseline justify-between px-nolus-24 pt-nolus-27"
                >
                  <div class="left w-full md:w-1/2">
                    <!--                <div class="loader">-->
                    <!--                  <div class="loader__element"></div>-->
                    <!--                </div>-->
                    <p class="nls-16 nls-font-500 m-0">Existing assets</p>
                  </div>
                  <div
                    class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end"
                  >
                    <div class="relative block checkbox-container">
                      <div class="flex items-center w-full justify-end">
                        <input
                          id="hide-small-balances"
                          v-model="hideLowerBalances"
                          aria-describedby="hide-small-balances"
                          name="hide-small-balances"
                          type="checkbox"
                        />
                        <p
                          class="nls-13 nls-font-400"
                          for="hide-small-balances"
                        >
                          Hide small balances
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Assets -->
                <div class="block mt-6 md:mt-[25px]">
                  <!-- Assets Header -->
                  <div
                    class="grid grid-cols-3 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6"
                  >
                    <div
                      class="nls-font-500 nls-12 text-dark-grey text-left text-upper"
                    >
                      Assets
                    </div>

                    <div
                      class="nls-font-500 nls-12 text-dark-grey text-right text-upper"
                    >
                      Price
                    </div>

                    <div
                      class="inline-flex items-center justify-end nls-font-500 nls-12 text-dark-grey text-left text-upper"
                    >
                      <span class="inline-block">Balance</span>
                      <!-- tooltip-->
                      <div
                        class="relative flex flex-col items-center icon-tooltip group group-tooltip"
                      >
                        <div
                          class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
                        >
                          <span
                            class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
                            >A top aligned tooltip.</span
                          >
                          <div
                            class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
                            style="background: #000; bottom: -4px"
                          ></div>
                        </div>
                      </div>
                      <!-- /tooltip-->
                    </div>

                    <div
                      class="hidden md:inline-flex items-center justify-end nls-font-500 nls-12 text-dark-grey text-left text-upper"
                    >
                      <span class="inline-block">Earnings</span>
                      <!-- tooltip-->
                      <div
                        class="relative flex flex-col items-center icon-tooltip group group-tooltip"
                      >
                        <div
                          class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
                        >
                          <span
                            class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
                            >A top aligned tooltip.</span
                          >
                          <div
                            class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
                            style="background: #000; bottom: -4px"
                          ></div>
                        </div>
                      </div>
                      <!-- /tooltip-->
                    </div>
                  </div>

                  <!-- Assets Container -->
                </div>

                <!-- Assets Container -->
                <div class="block">
                  <div
                    :class="[
                      'grid gap-6 border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                      colstest
                        ? 'grid-cols-' + colstest
                        : 'grid-cols-3 md:grid-cols-4',
                    ]"
                  >
                    <!-- Ticker -->
                    <div class="inline-flex items-center">
                      <img
                        src="@/assets/icons/coins/btc.svg"
                        class="inline-block m-0 mr-4"
                        height="32"
                        width="32"
                      />
                      <div class="inline-block">
                        <p
                          class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                        >
                          BTC
                        </p>
                        <p
                          class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                        >
                          Bitcoin
                        </p>
                      </div>
                    </div>

                    <!-- Price -->
                    <div class="block">
                      <p
                        class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                      >
                        $ 20,000.89
                      </p>
                      <div
                        class="flex items-center justify-end text-primary nls-13 nls-font-400 text-right m-0"
                      >
                        <img
                          src="@/assets/icons/change-positive.svg"
                          class="inline-block m-0 mr-2"
                        />
                        <span class="inline-block"> 2% </span>
                      </div>
                    </div>

                    <!-- Balance -->
                    <div class="block">
                      <p
                        class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                      >
                        $20,0000.00
                      </p>
                      <div
                        class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                      >
                        1.23456780 BTC
                      </div>
                    </div>

                    <!-- Earnings -->
                    <div class="hidden md:block">
                      <div
                        class="flex items-center justify-end text-primary nls-font-500 nls-13 nls-font-400 text-right m-0"
                      >
                        Up to 3% APY
                      </div>
                    </div>
                  </div>
                </div>
                <div class="block">
                  <div
                    :class="[
                      'grid gap-6 border-b border-standart px-nolus-24 py-nolus-12  items-center justify-between',
                      cols - 5
                        ? 'grid-cols-' + cols
                        : 'grid-cols-3 md:grid-cols-4',
                    ]"
                  >
                    <!-- Ticker -->
                    <div class="inline-flex items-center">
                      <img
                        src="@/assets/icons/coins/nls.svg"
                        class="inline-block m-0 mr-4"
                        height="32"
                        width="32"
                      />
                      <div class="inline-block">
                        <p
                          class="text-primary nls-font-500 nls-18 text-left uppercase m-0"
                        >
                          NLS
                        </p>
                        <p
                          class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0"
                        >
                          Nolus
                        </p>
                      </div>
                    </div>

                    <!-- Price -->
                    <div class="block">
                      <p
                        class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                      >
                        $0.1000
                      </p>
                      <div
                        class="flex items-center justify-end text-primary nls-13 nls-font-400 text-right m-0"
                      >
                        <img
                          src="@/assets/icons/change-negative.svg"
                          class="inline-block m-0 mr-2"
                        />
                        <span class="inline-block"> -1.19% </span>
                      </div>
                    </div>

                    <!-- Balance -->
                    <div class="block">
                      <p
                        class="text-primary nls-font-500 nls-16 nls-font-500 text-right m-0"
                      >
                        $32,0000
                      </p>
                      <div
                        class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
                      >
                      </div>
                    </div>

                    <!-- Earnings -->
                    <div class="hidden md:block">
                      <div
                        class="flex items-center justify-end text-primary nls-font-500 nls-13 nls-font-400 text-right m-0"
                      >
                        Up to 24% APY
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Assets Container -->
              </div>

              <!-- /all assets -->

              <!-- CONNECT -->
              <div class="col-span-12 mt-nolus-41">
                <div class="max-w-[515px] mr-auto ml-auto">
                  <AuthView />
                </div>
              </div>
              <!-- /CONNECT -->
            </div>
          </div>
        </div>
        <!-- HEADERS -->

        <!-- ICONS -->
        <div id="icons" class="col-span-12">
          <div class="grid grid-cols-12 gap-2">
            <div class="col-span-12 pt-8">
              <h1 class="text nls-font-700 nls-32">Icons</h1>
            </div>

            <div
              class="flex flex-col col-span-2 justify-center justify-start mt-10"
            >
              <span class="icon-assets"></span>
              <p>.icon-assets</p>
            </div>
            <div
              class="flex flex-col col-span-2 justify-center justify-start mt-10"
            >
              <span class="icon-wallet"></span>
              <p>.icon-wallet</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-arrow-long-down"></span>
              <p>.icon-arrow-long-down</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-arrow-long-up"></span>
              <p>.icon-arrow-long-up</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-arrow-short-down"></span>
              <p>.icon-arrow-short-down</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-arrow-short-left"></span>
              <p>.icon-arrow-short-left</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-arrow-short-right"></span>
              <p>.icon-arrow-short-right</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-arrow-short-up"></span>
              <p>.icon-arrow-short-up</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-bell"></span>
              <p>.icon-bell</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-calendar"></span>
              <p>.icon-calendar</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-close"></span>
              <p>.icon-close</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-collapse"></span>
              <p>.icon-collapse</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-copy"></span>
              <p>.icon-copy</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-discord"></span>
              <p>.icon-discord</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-google"></span>
              <p>.icon-google</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-keplr"></span>
              <p>.icon-keplr</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-medium"></span>
              <p>.icon-medium</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-earn"></span>
              <p>.icon-earn</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-nav-governance"></span>
              <p>.icon-nav-governance</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-nav-history"></span>
              <p>.icon-history</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-nav-lease"></span>
              <p>.icon-nav-lease</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-nav-more"></span>
              <p>.icon-nav-more</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-nav-swap"></span>
              <p>.icon-nav-swap</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-person"></span>
              <p>.icon-person</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-picker"></span>
              <p>.icon-picker</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-print"></span>
              <p>.icon-print</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-reddit"></span>
              <p>.icon-reddit</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-scan"></span>
              <p>.icon-scan</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-star"></span>
              <p>.icon-star</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-success"></span>
              <p>.icon-success</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-telegram"></span>
              <p>.icon-telegram</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-tooltip"></span>
              <p>.icon-tooltip</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-twitter"></span>
              <p>.icon-twitter</p>
            </div>

            <div class="flex flex-col col-span-2 justify-center justify-start">
              <span class="icon-recover"></span>
              <p>.icon-recover</p>
            </div>
          </div>
        </div>
        <!-- ICONS -->

        <!-- SNACK BAR & TOOLTIPS -->

        <!-- /SNACK BAR-->
<!-- 
        <div id="snackbar_tooltip" class="col-span-12">
          <div class="col-span-12 pt-8">
            <h1 class="text nls-font-700 nls-32">Snackbar &Tooltip</h1>
          </div>
          <div class="col-span-12 pt-8">
            <SnackBar
              :icon="'js-loading'"
              :mainContent="'Pending'"
              :plainContent="'Transaction'"
            />
          </div>
        </div> -->

        <!-- /SNACK BAR-->

        <!-- TOOLTIP -->
        <div class="flex items-center justify-center mt-[25px]">
          <!-- Component Start -->
          <div class="relative flex flex-col items-center group group-tooltip">
            <svg
              class="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clip-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                fill-rule="evenodd"
              />
            </svg>
            <div
              class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
            >
              <span
                class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
                >A top aligned tooltip.</span
              >
              <div
                class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
                style="background: #000; bottom: -4px"
              ></div>
            </div>
          </div>
          <!-- Component End  -->
        </div>
        <!-- /TOOLTIP -->

        <!-- MODALS -->
        <div id="modals" class="col-span-12">
          <!-- Buttons -->
          <div class="grid grid-cols-12 gap-6 mt-8">
            <div class="col-span-12">
              <h1 class="text nls-font-700 nls-32">Modals</h1>

              <!-- Medium - Secondary -->
              <div class="flex mt-[25px]">
                <button
                  class="btn btn-secondary btn-medium-secondary mr-4"
                  @click="showSendModal = true"
                >
                  Send / Receive
                </button>

                <button
                  class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                  @click="() => (showSupplyWithdrawModal = true)"
                >
                  Supply Modal
                </button>

                <!-- <button
                  class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                  @click="() => (showLeaseModal = true)"
                >
                  Lease Modal
                </button>
                <button
                  class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                  @click="() => (showRepayModal = true)"
                >
                  Repay Modal
                </button> -->

                <button
                  class="btn btn-secondary btn-medium-secondary btn-emphatized mr-4"
                  @click="() => (showSwapModal = true)"
                >
                  Swap
                </button>
              </div>
            </div>
          </div>
        </div>
        <LeaseMainComponent
          v-show="showLeaseModal"
          @close-modal="showLeaseModal = false"
        />
        <!-- <RepayMainComponent
          v-show="showRepayModal"
          @close-modal="showRepayModal = false" -->
        />
        <!-- /MODALS -->
        <!-- HISTORY -->

        <div id="history" class="col-span-12">
          <div class="grid grid-cols-12 gap-2">
            <div class="col-span-12 pt-8">
              <h1 class="text nls-font-700 nls-32">History</h1>
            </div>
            <div class="col-span-12 pt-8">
              <HistoryView />
            </div>
          </div>
        </div>
        <!-- /HISTORY -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BellIcon } from "@heroicons/vue/24/solid";
import LogoLink from "@/components/LogoLink.vue";

import SidebarElement from "@/components/SidebarElement.vue";
import HistoryView from "@/views/HistoryView.vue";
import AuthView from "@/views/AuthView.vue";
import SidebarHeader from "@/components/Sideheader.vue";
import LeaseMainComponent from "@/components/LeaseComponents/LeaseMainComponent.vue";
import { onMounted, ref } from "vue";
import {
  DISCORD_ACCOUNT,
  MEDIUM_ACCOUNT,
  REDDIT_ACCOUNT,
  TELEGRAM_ACCOUNT,
  TWITTER_ACCOUNT,
} from "@/config/globals";

const showSwapModal = ref(false as boolean);
const showRepayModal = ref(false as boolean);
const showLeaseModal = ref(false as boolean);
const showSendModal = ref(false as boolean);
const showSupplyWithdrawModal = ref(false as boolean);
const showConfirmEmailModal = ref(false as boolean);
const cols = ref(0 as number);
const colstest = ref(0 as number);
const hideLowerBalances = ref(false);

onMounted(() => {
  colstest.value = 4;
  showSwapModal.value = false;
  showRepayModal.value = false;
  showLeaseModal.value = false;
  showSendModal.value = false;
  showConfirmEmailModal.value = false;
  showSupplyWithdrawModal.value = false;
  cols.value = 2;
});
</script>

<style scoped>
[class^="icon-"] {
  font-size: 1.8em !important;
}

.nls-btn-show {
  opacity: 0;
  display: none;
  transition: 0.3s;
}

.row-actions:hover .nls-btn-show {
  opacity: 1;
  display: flex;
  animation-name: show-anime;
  animation-duration: 0.3s;
  animation-delay: 0.5s;
  animation-iteration-count: 1;
  animation-timing-function: ease-in;
}

.info-show {
  animation-name: show-anime;
  animation-duration: 0.3s;
  animation-delay: 0.5s;
  animation-iteration-count: 1;
  animation-timing-function: ease-in;
  transition: 0.3s;
}

.row-actions:hover .info-show {
  display: none;
}
</style>
