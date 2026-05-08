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

import arrowup from "@/assets/icons/arrowup.svg?url";
import arrowdown from "@/assets/icons/arrowdown.svg?url";
import shareImageOne from "@/assets/icons/share-image-1.svg?url";
import shareImageTwo from "@/assets/icons/share-image-2.png?url";
import shareImageThree from "@/assets/icons/share-image-3.png?url";
import shareImageFour from "@/assets/icons/share-image-4.png?url";
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
const images = [shareImageOne, shareImageTwo, shareImageThree, shareImageFour];
const canvasRefs = ref<{ [key: string]: HTMLCanvasElement }>({});

const showPnlAmount = ref(true);
const showPrice = ref(true);
const showPositionSize = ref(true);

type Palette = {
  text: string;
  muted: string;
};

// Per-cover text palette. PnL +/- and pill colors stay constant — the shared
// dark-blue/green/red set has enough contrast against every cover.
const palettes: Palette[] = [
  { text: "#082D63", muted: "#5E7699" }, // 1: light grey/peach gradient
  { text: "#FFFFFF", muted: "#C1CAD7" }, // 2: dark navy illustration
  { text: "#082D63", muted: "#5E7699" }, // 3: orange
  { text: "#082D63", muted: "#5E7699" } // 4: light lavender
];

const PNL_POSITIVE = "#1AB171";
const PNL_NEGATIVE = "#ab1f3b";
const PILL_TEXT = "#FFFFFF";

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

const renderCard = async (ctx: CanvasRenderingContext2D, bgSrc: string) => {
  await setBackground(ctx, bgSrc);

  const metric = await getBuyTextWidth(ctx);
  drawPositionPill(ctx, metric);

  // setArrow + setAsset are awaited because they paint asynchronously via
  // image.onload. Without await, a re-render triggered mid-flight (e.g. by the
  // toggle watcher) lets a prior render's onload fire onto a newer frame's
  // canvas, swapping in stale arrow direction / asset icon.
  await setArrow(ctx);
  setBuyText(ctx);
  await setAsset(ctx);

  // PnL hero block (always shown). Inline absolute amount when toggle is on.
  setPnlPercent(ctx);
  if (showPnlAmount.value) {
    setPnlAmountInline(ctx);
  }

  // Optional rows stack below the PnL block. y-cursor advances per rendered row.
  let cursorY = 555;
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

function drawPositionPill(ctx: CanvasRenderingContext2D, textWidth: number) {
  const radius = 20;
  const x = 90;
  const y = 230;
  const width = textWidth + 100;
  const height = 60;

  const fill = pnlNumber() < 0 ? PNL_NEGATIVE : PNL_POSITIVE;
  ctx.strokeStyle = fill;
  ctx.fillStyle = fill;
  ctx.lineJoin = "round";
  ctx.lineWidth = radius;

  ctx.strokeRect(x + radius * 0.5, y + radius * 0.5, width - radius, height - radius);
  ctx.fillRect(x + radius * 0.5, y + radius * 0.5, width - radius, height - radius);
  ctx.stroke();
  ctx.fill();
}

async function setArrow(ctx: CanvasRenderingContext2D) {
  const image = new Image();
  const data = await fetch(pnlNumber() < 0 ? arrowdown : arrowup);
  const blob = await data.blob();

  return new Promise<void>((resolve) => {
    image.onload = () => {
      ctx.drawImage(image, 110, 247, 28, 26);
      resolve();
    };
    image.src = window.URL.createObjectURL(blob);
  });
}

async function getBuyTextWidth(ctx: CanvasRenderingContext2D) {
  ctx.font = "600 30px 'Garet'";
  const posType = leaseData ? configStore.getPositionType(leaseData.protocol).toLowerCase() : "long";
  return ctx.measureText(`${i18n.t(`message.${posType}`)} ${i18n.t("message.buy-position")}`.toUpperCase()).width;
}

async function setBuyText(ctx: CanvasRenderingContext2D) {
  ctx.font = "600 30px 'Garet'";
  ctx.fillStyle = PILL_TEXT;
  const posType = leaseData ? configStore.getPositionType(leaseData.protocol).toLowerCase() : "long";
  ctx.fillText(`${i18n.t(`message.${posType}`)} ${i18n.t("message.buy-position")}`.toUpperCase(), 150, 270);
}

async function setAsset(ctx: CanvasRenderingContext2D) {
  const asst = asset();
  if (!asst) return;

  const image = new Image();
  const data = await fetch(asst.icon);
  const blob = await data.blob();
  const textColor = palette().text;

  return new Promise<void>((resolve) => {
    image.onload = () => {
      const rect = 60;
      const hf = rect / image.height;
      const width = hf * image.width;
      ctx.drawImage(image, 100, 310, width, hf * image.height);

      ctx.font = "500 42px 'Garet'";
      ctx.fillStyle = textColor;
      if (asst.shortName) {
        ctx.fillText(asst.shortName, 115 + width, 350);
      }
      resolve();
    };
    image.src = window.URL.createObjectURL(blob);
  });
}

function setPnlPercent(ctx: CanvasRenderingContext2D) {
  const pos = pnlNumber();
  const symbol = pos < 0 ? "-" : "+";
  const [a, d] = Math.abs(pos).toFixed(2).split(".");

  ctx.fillStyle = pos < 0 ? PNL_NEGATIVE : PNL_POSITIVE;

  const amount = `${symbol}${formatNumber(a, 0)}`;
  ctx.font = "600 72px 'Garet'";
  ctx.fillText(amount, 90, 490);

  const w = ctx.measureText(amount).width;
  ctx.font = "600 58px 'Garet'";
  ctx.fillText(`.${d}%`, 90 + w, 490);
}

function setPnlAmountInline(ctx: CanvasRenderingContext2D) {
  ctx.font = "600 72px 'Garet'";
  const pos = pnlNumber();
  const symbol = pos < 0 ? "-" : "+";
  const [a, d] = Math.abs(pos).toFixed(2).split(".");
  const integerWidth = ctx.measureText(`${symbol}${formatNumber(a, 0)}`).width;
  ctx.font = "600 58px 'Garet'";
  const decimalWidth = ctx.measureText(`.${d}%`).width;

  ctx.font = "500 32px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(`(${pnlAmountFormatted()})`, 90 + integerWidth + decimalWidth + 18, 485);
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
  const timestamp = new Date();
  const m = timestamp.getMonth() + 1;
  const d = timestamp.getDate();
  const h = timestamp.getHours();
  const min = timestamp.getMinutes();

  const year = timestamp.getFullYear();
  const month = m.toString().length == 1 ? `0${m}` : m;
  const day = d.toString().length == 1 ? `0${d}` : d;
  const hours = h.toString().length == 1 ? `0${h}` : h;
  const minutes = min.toString().length == 1 ? `0${min}` : min;

  ctx.font = "500 32px 'Garet'";
  ctx.fillStyle = palette().muted;
  ctx.fillText(`${i18n.t("message.timestamp")}:  ${year}-${month}-${day} ${hours}:${minutes}`, 90, 800);
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
