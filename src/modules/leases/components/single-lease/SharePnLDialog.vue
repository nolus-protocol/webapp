<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.share-position`)"
    showClose
    class-list="md:h-fit"
  >
    <template v-slot:content>
      <div class="custom-scroll max-h-full flex-1 overflow-auto">
        <div class="flex flex-col gap-6 px-6 pb-6 text-typography-default">
          <div class="flex flex-col gap-4">
            <span class="text-16">{{ $t("message.cover-design") }}</span>
            <div class="flex justify-between">
              <button
                class="w-full max-w-[108px] overflow-hidden rounded"
                v-for="(img, index) of images"
                :key="index"
                :class="{ selected: index == imageIndex }"
                @click="setBackgroundIndex(index)"
              >
                <canvas
                  :ref="(el) => (canvasRefs[index] = el as HTMLCanvasElement)"
                  class="w-full rounded"
                ></canvas>
              </button>
            </div>
          </div>
          <div>
            <canvas
              class="w-full rounded"
              ref="canvas"
            ></canvas>
          </div>
          <div class="flex flex-col gap-3">
            <span class="text-16">{{ $t("message.optional-info-share") }}</span>
            <div class="flex flex-wrap gap-x-6 gap-y-3">
              <Checkbox
                id="share-pnl-amount"
                :label="$t('message.pnl-amount')"
                v-model="showPnlAmount"
                @input="() => {}"
              />
              <Checkbox
                id="share-price"
                :label="$t('message.price')"
                v-model="showPrice"
                @input="() => {}"
              />
              <Checkbox
                id="share-position-size"
                :label="$t('message.lease-size')"
                v-model="showPositionSize"
                @input="() => {}"
              />
            </div>
          </div>
        </div>

        <hr class="border-border-color" />
      </div>
      <div class="flex gap-4 p-6">
        <Button
          size="medium"
          severity="primary"
          :label="$t(`message.share`)"
          class="flex-1"
          @click="share()"
          v-if="supportShare()"
        />
        <Button
          size="medium"
          severity="secondary"
          :label="$t(`message.download-png`)"
          class="flex-1"
          @click="download()"
        />
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { nextTick, ref, watch } from "vue";
import { Button, Checkbox, Dialog } from "web-components";
import { Logger } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker, getCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { useI18n } from "vue-i18n";

import shareImageTwo from "@/assets/icons/share-image-2.png?url";
import shareImageThree from "@/assets/icons/share-image-3.png?url";
import shareImageFour from "@/assets/icons/share-image-4.png?url";
import logoLight from "@/assets/icons/logo-light.svg?url";
import logoDark from "@/assets/icons/logo-dark.svg?url";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";
import { NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";

const dialog = ref<typeof Dialog | null>(null);
const canvas = ref<HTMLCanvasElement>();
const i18n = useI18n();
const configStore = useConfigStore();
const pricesStore = usePricesStore();
const imageIndex = ref(0);
const images = [shareImageTwo, shareImageThree, shareImageFour];
const canvasRefs = ref<{ [key: string]: HTMLCanvasElement }>({});

const showPnlAmount = ref(true);
const showPrice = ref(true);
const showPositionSize = ref(true);

type Palette = {
  text: string;
  muted: string;
  logo: "light" | "dark";
};

// Per-cover palette covers text + logo variant only. PnL colors are a single
// brand pair (PNL_POSITIVE / PNL_NEGATIVE) used on every cover for visual
// consistency across the share library.
const palettes: Palette[] = [
  { text: "#FFFFFF", muted: "#C1CAD7", logo: "light" }, // dark navy illustration
  { text: "#082D63", muted: "#5E7699", logo: "dark" }, // orange
  { text: "#082D63", muted: "#5E7699", logo: "dark" } // light lavender
];

const PNL_POSITIVE = "#1AB171";
const PNL_NEGATIVE = "#AB1F3B";

let leaseData: LeaseInfo | null;
let leaseDisplayData: LeaseDisplayData | null;

const palette = (): Palette => palettes[imageIndex.value] ?? palettes[0];

const asset = () => {
  if (!leaseData) return undefined;

  // For opening status with ETL data
  if (leaseData.status === "opening" && leaseData.etl_data?.lease_position_ticker) {
    const item = configStore.currenciesData?.[`${leaseData.etl_data.lease_position_ticker}@${leaseData.protocol}`];
    return item;
  }

  const positionType = configStore.getPositionType(leaseData.protocol);

  if (positionType === "Long") {
    const ticker = leaseData.amount.ticker;
    const item = getCurrencyByTicker(ticker as string);
    const assetData = getCurrencyByDenom(item?.ibcData as string);
    return assetData;
  } else {
    const ticker = leaseData.debt?.ticker ?? leaseData.amount.ticker;
    const item = getCurrencyByTicker(ticker as string);
    const assetData = getCurrencyByDenom(item?.ibcData as string);
    return assetData;
  }
};

const currentPrice = () => {
  if (!leaseData) return "0";

  const positionType = configStore.getPositionType(leaseData.protocol);

  if (positionType === "Long") {
    if (leaseData.status === "opening" && leaseData.etl_data?.lease_position_ticker) {
      const item = configStore.currenciesData?.[`${leaseData.etl_data.lease_position_ticker}@${leaseData.protocol}`];
      return formatNumber(
        pricesStore.prices[item?.ibcData as string]?.price ?? "0",
        NATIVE_CURRENCY.maximumFractionDigits
      );
    }
  } else {
    if (leaseData.status === "opening" && leaseData.debt?.ticker) {
      return formatNumber(
        pricesStore.prices[`${leaseData.debt.ticker}@${leaseData.protocol}`]?.price ?? "0",
        NATIVE_CURRENCY.maximumFractionDigits
      );
    }
  }

  const ticker =
    positionType === "Short"
      ? (leaseData.debt?.ticker ?? leaseData.amount.ticker)
      : (leaseData.etl_data?.lease_position_ticker ?? leaseData.amount.ticker);

  return formatNumber(
    pricesStore.prices[`${ticker}@${leaseData.protocol}`]?.price ?? "0",
    NATIVE_CURRENCY.maximumFractionDigits
  );
};

const entryPrice = () => {
  if (!leaseDisplayData) return "0";
  return formatNumber(leaseDisplayData.openingPrice.toString(), NATIVE_CURRENCY.maximumFractionDigits);
};

const positionSizeUsd = () => {
  if (!leaseDisplayData) return "0";
  return formatNumber(leaseDisplayData.assetValueUsd.toString(), 2);
};

const pnlNumber = () => Number(leaseDisplayData?.pnlPercent.toString(2) ?? "0");

// Effective leverage at open: (downPayment + debt) / downPayment. For a
// freshly opened lease the debt equals the borrowed principal, so this is the
// classic "I went 2.5x on this trade" number. As interest accrues totalDebt
// drifts up, which would creep this slightly over its initial value — small
// effect over the lifetime of a lease and acceptable for a share card.
const leverageMultiple = (): string | null => {
  if (!leaseDisplayData) return null;
  const dp = leaseDisplayData.downPayment;
  if (!dp.isPositive()) return null;
  const lev = dp.add(leaseDisplayData.totalDebt).quo(dp);
  return `x${Number(lev.toString()).toFixed(1)}`;
};

const pnlAmountFormatted = () => {
  if (!leaseDisplayData) return "$0.00";
  const amount = leaseDisplayData.pnlAmount;
  const sign = amount.isNegative() ? "-" : "+";
  return `${sign}$${formatNumber(amount.abs().toString(), 2)}`;
};

const supportShare = () => {
  return !!navigator.share;
};

function setBackgroundIndex(index: number) {
  imageIndex.value = index;
  generateCanvas();
}

watch([showPnlAmount, showPrice, showPositionSize], () => {
  generateCanvas();
  for (const key in canvasRefs.value) {
    const img = images[key as keyof typeof images];
    generateSmallCanvas(canvasRefs.value[key], img as string);
  }
});

// Font preload. ctx.font = "..." picks the font synchronously but does not
// wait for the @font-face rule to load — the first canvas paint after dialog
// open silently falls back to the system serif/sans until the browser
// ambient-loads Garet via DOM use elsewhere. Awaiting document.fonts.load on
// every spec we paint forces the font into the document's font set up front.
// Memoized: subsequent calls resolve immediately.
let fontsReady: Promise<void> | null = null;
const FONT_SPECS = [
  "500 24px 'Garet'",
  "500 28px 'Garet'",
  "500 32px 'Garet'",
  "500 36px 'Garet'",
  "600 80px 'Garet'",
  "600 96px 'Garet'"
];
const ensureFonts = (): Promise<void> => {
  if (fontsReady) return fontsReady;
  if (typeof document === "undefined" || !document.fonts) {
    fontsReady = Promise.resolve();
    return fontsReady;
  }
  // Catch the rejection so a font-load failure (404, CSP block, transient
  // network) degrades to the system fallback. Without the catch a single
  // failure poisons every render through the memoized promise.
  fontsReady = Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec)))
    .then(() => undefined)
    .catch(() => undefined);
  return fontsReady;
};

const renderCard = async (ctx: CanvasRenderingContext2D, bgSrc: string) => {
  await ensureFonts();
  await setBackground(ctx, bgSrc);

  // setLogo is awaited (image.onload) so the logo paints before any later
  // render's setBackground overwrites the canvas. Same pattern as in PR-A.
  await setLogo(ctx);

  setPositionMetaRow(ctx);

  // PnL hero block (always shown). Inline absolute amount when toggle is on.
  setPnlPercent(ctx);
  if (showPnlAmount.value) {
    setPnlAmountInline(ctx);
  }

  // Optional rows stack below the PnL block. y-cursor advances per rendered row.
  let cursorY = 540;
  if (showPrice.value) {
    setEntryPriceRow(ctx, cursorY);
    cursorY += 50;
    setMarkPriceRow(ctx, cursorY);
    cursorY += 50;
  }
  if (showPositionSize.value) {
    setPositionSizeRow(ctx, cursorY);
  }

  setTimeStamp(ctx);
  setBrandUrl(ctx);
};

// Per-canvas promise chain. Without this, a render triggered while a previous
// render of the same canvas is mid-flight (e.g. user toggles a checkbox before
// the prior renderCard's image.onload chain finishes) interleaves: stale paints
// from the older render land on top of the newer render's bg, and toggle
// changes can leave ghost rows visible. Each new render chains after the
// previous one for that canvas, so renders fully serialize per-canvas.
const renderChains = new WeakMap<HTMLCanvasElement, Promise<void>>();

const scheduleRender = (canvasElement: HTMLCanvasElement, imgSrc: string): Promise<void> => {
  const prev = renderChains.get(canvasElement) ?? Promise.resolve();
  const next = prev.then(async () => {
    try {
      const context = canvasElement.getContext("2d") as CanvasRenderingContext2D;
      canvasElement.width = 1600;
      canvasElement.height = 900;
      await renderCard(context, imgSrc);
    } catch (e) {
      Logger.error(e);
    }
  });
  renderChains.set(canvasElement, next);
  return next;
};

const generateSmallCanvas = (canvasElement: HTMLCanvasElement, imgSrc: string) => scheduleRender(canvasElement, imgSrc);

const generateCanvas = () => {
  const canvasElement = canvas.value;
  if (!canvasElement) return;
  return scheduleRender(canvasElement, images[imageIndex.value]);
};

async function setBackground(ctx: CanvasRenderingContext2D, src: string) {
  const image = new Image();
  const data = await fetch(src);
  const blob = await data.blob();

  return new Promise<void>((resolve) => {
    image.onload = async () => {
      ctx.drawImage(image, 0, 0, 1600, 900);
      return resolve();
    };

    image.src = window.URL.createObjectURL(blob);
  });
}

// Compact meta row at the top of the type column. Synchronous — no images.
//   LONG x2.5 | BTC
// Direction colored by sign (positive tone for Long, negative for Short),
// leverage + ticker neutral, separator muted. Leverage segment is omitted if
// downPayment is zero (defensive — should never happen in practice).
function setPositionMetaRow(ctx: CanvasRenderingContext2D) {
  const asst = asset();
  if (!asst) return;

  const positionType = leaseData ? configStore.getPositionType(leaseData.protocol) : "Long";
  const directionLabel = i18n.t(`message.${positionType.toLowerCase()}`).toUpperCase();
  const tickerLabel = asst.shortName ?? "";
  const lev = leverageMultiple();
  const pal = palette();
  const directionColor = positionType === "Short" ? PNL_NEGATIVE : PNL_POSITIVE;

  const baselineY = 240;
  const baseX = 90;
  const separator = " | ";
  let cursorX = baseX;

  ctx.font = "600 36px 'Garet'";
  ctx.fillStyle = directionColor;
  ctx.fillText(directionLabel, cursorX, baselineY);
  cursorX += ctx.measureText(directionLabel).width;

  if (lev) {
    const levText = ` ${lev}`;
    ctx.fillStyle = pal.text;
    ctx.fillText(levText, cursorX, baselineY);
    cursorX += ctx.measureText(levText).width;
  }

  if (tickerLabel) {
    ctx.fillStyle = pal.muted;
    ctx.fillText(separator, cursorX, baselineY);
    cursorX += ctx.measureText(separator).width;

    ctx.fillStyle = pal.text;
    ctx.fillText(tickerLabel, cursorX, baselineY);
  }
}

// Render the Nolus logo (mark + wordmark) top-left of the canvas. Uses
// logo-light.svg on dark covers, logo-dark.svg on light covers. The logo SVG
// is 126x32 native; rendered at 2x = 252x64. Awaited so the image.onload
// paints before the next render's setBackground overwrites the bitmap.
async function setLogo(ctx: CanvasRenderingContext2D) {
  const variant = palette().logo;
  const src = variant === "light" ? logoLight : logoDark;

  const image = new Image();
  const data = await fetch(src);
  const blob = await data.blob();

  return new Promise<void>((resolve) => {
    image.onload = () => {
      const w = 252;
      const h = 64;
      ctx.drawImage(image, 80, 80, w, h);
      resolve();
    };
    image.src = window.URL.createObjectURL(blob);
  });
}

function setBrandUrl(ctx: CanvasRenderingContext2D) {
  ctx.font = "500 26px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText("nolus.io", 90, 858);
}

const PNL_HERO_BASELINE_Y = 430;

function setPnlPercent(ctx: CanvasRenderingContext2D) {
  const pos = pnlNumber();
  const symbol = pos < 0 ? "-" : "+";
  const [a, d] = Math.abs(pos).toFixed(2).split(".");

  ctx.fillStyle = pos < 0 ? PNL_NEGATIVE : PNL_POSITIVE;

  const amount = `${symbol}${formatNumber(a, 0)}`;
  ctx.font = "600 96px 'Garet'";
  ctx.fillText(amount, 90, PNL_HERO_BASELINE_Y);

  const w = ctx.measureText(amount).width;
  ctx.font = "600 80px 'Garet'";
  ctx.fillText(`.${d}%`, 90 + w, PNL_HERO_BASELINE_Y);
}

function setPnlAmountInline(ctx: CanvasRenderingContext2D) {
  ctx.font = "600 96px 'Garet'";
  const pos = pnlNumber();
  const symbol = pos < 0 ? "-" : "+";
  const [a, d] = Math.abs(pos).toFixed(2).split(".");
  const integerWidth = ctx.measureText(`${symbol}${formatNumber(a, 0)}`).width;
  ctx.font = "600 80px 'Garet'";
  const decimalWidth = ctx.measureText(`.${d}%`).width;

  ctx.font = "500 36px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(`(${pnlAmountFormatted()})`, 90 + integerWidth + decimalWidth + 22, PNL_HERO_BASELINE_Y - 8);
}

function setEntryPriceRow(ctx: CanvasRenderingContext2D, y: number) {
  const label = i18n.t("message.entry-price");
  ctx.font = "500 24px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(label, 90, y);

  const labelWidth = ctx.measureText(label).width;
  ctx.font = "500 28px 'Garet'";
  ctx.fillStyle = palette().text;
  ctx.fillText(`$${entryPrice()}`, 90 + labelWidth + 20, y);
}

function setMarkPriceRow(ctx: CanvasRenderingContext2D, y: number) {
  const label = i18n.t("message.mark-price");
  ctx.font = "500 24px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(label, 90, y);

  const labelWidth = ctx.measureText(label).width;
  ctx.font = "500 28px 'Garet'";
  ctx.fillStyle = palette().text;
  ctx.fillText(`$${currentPrice()}`, 90 + labelWidth + 20, y);
}

function setPositionSizeRow(ctx: CanvasRenderingContext2D, y: number) {
  const label = i18n.t("message.lease-size");
  ctx.font = "500 24px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(label, 90, y);

  const labelWidth = ctx.measureText(label).width;
  ctx.font = "500 28px 'Garet'";
  ctx.fillStyle = palette().text;
  ctx.fillText(`$${positionSizeUsd()}`, 90 + labelWidth + 20, y);
}

function setTimeStamp(ctx: CanvasRenderingContext2D) {
  const now = new Date();
  const locale = i18n.locale.value;
  const datePart = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);

  ctx.font = "500 28px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(`${datePart} · ${timePart}`, 90, 820);
}

function download() {
  const anchor = document.createElement("a");
  anchor.href = canvas.value!.toDataURL("image/png");
  anchor.download = "position.png";
  anchor.click();
  anchor.remove();
}

function share() {
  if (navigator.share == null) {
    return download();
  }

  const canvasElement = canvas.value as HTMLCanvasElement;
  canvasElement.toBlob(async (blob) => {
    try {
      const filesArray = [
        new File([blob as Blob], "position.png", {
          type: blob?.type,
          lastModified: new Date().getTime()
        })
      ];
      const shareData = {
        files: filesArray
      };

      await navigator.share(shareData);
    } catch (error) {
      Logger.error(error);
    }
  }, "image/png");
}

defineExpose({
  show: async (data: LeaseInfo, displayData?: LeaseDisplayData) => {
    leaseData = data;
    leaseDisplayData = displayData ?? null;
    dialog?.value?.show();
    await nextTick();
    generateCanvas();

    for (const key in canvasRefs.value) {
      const img = images[key as keyof typeof images];
      generateSmallCanvas(canvasRefs.value[key], img as string);
    }
  }
});
</script>
<style scoped lang="scss">
.selected {
  position: relative;
  &::before {
    content: "";
    position: absolute;
    box-shadow: inset 0px 0px 0px 2px theme("colors.blue.500");

    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
  }
}
</style>
