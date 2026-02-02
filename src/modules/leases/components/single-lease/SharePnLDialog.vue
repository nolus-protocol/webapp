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
import { ref } from "vue";
import { Button, Dialog } from "web-components";
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
import { NATIVE_CURRENCY, PositionTypes, ProtocolsConfig } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { usePricesStore } from "@/common/stores/prices";

const dialog = ref<typeof Dialog | null>(null);
const canvas = ref<HTMLCanvasElement>();
const i18n = useI18n();
const app = useApplicationStore();
const pricesStore = usePricesStore();
const imageIndex = ref(0);
const images = [shareImageOne, shareImageTwo, shareImageThree, shareImageFour];
const canvasRefs = ref<{ [key: string]: HTMLCanvasElement }>({});

const colors = {
  red: "#ab1f3b",
  green: "#1AB171",
  white: "white",
  gray: "#c1cad7"
};

let leaseData: LeaseInfo | null;
let leaseDisplayData: LeaseDisplayData | null;

const asset = () => {
  if (!leaseData) return undefined;
  
  // For opening status with ETL data
  if (leaseData.status === "opening" && leaseData.etl_data?.lease_position_ticker) {
    const item = app.currenciesData?.[`${leaseData.etl_data.lease_position_ticker}@${leaseData.protocol}`];
    return item;
  }

  switch (ProtocolsConfig[leaseData.protocol]?.type) {
    case PositionTypes.long: {
      const ticker = leaseData.amount.ticker;
      const item = getCurrencyByTicker(ticker as string);
      const assetData = getCurrencyByDenom(item?.ibcData as string);
      return assetData;
    }
    case PositionTypes.short: {
      const ticker = leaseData.etl_data?.lease_position_ticker ?? leaseData.amount.ticker;
      const item = getCurrencyByTicker(ticker as string);
      const assetData = getCurrencyByDenom(item?.ibcData as string);
      return assetData;
    }
  }
};

const currentPrice = () => {
  if (!leaseData) return "0";
  
  switch (ProtocolsConfig[leaseData.protocol]?.type) {
    case PositionTypes.long: {
      if (leaseData.status === "opening" && leaseData.etl_data?.lease_position_ticker) {
        const item = app.currenciesData?.[`${leaseData.etl_data.lease_position_ticker}@${leaseData.protocol}`];
        return formatNumber(
          pricesStore.prices[item?.ibcData as string]?.price ?? "0",
          NATIVE_CURRENCY.maximumFractionDigits
        );
      }
      break;
    }
    case PositionTypes.short: {
      if (leaseData.status === "opening" && leaseData.debt?.ticker) {
        return formatNumber(
          pricesStore.prices[`${leaseData.debt.ticker}@${leaseData.protocol}`]?.price ?? "0",
          NATIVE_CURRENCY.maximumFractionDigits
        );
      }
    }
  }

  const ticker = leaseData.etl_data?.lease_position_ticker ?? leaseData.amount.ticker;

  return formatNumber(
    pricesStore.prices[`${ticker}@${leaseData.protocol}`]?.price ?? "0",
    NATIVE_CURRENCY.maximumFractionDigits
  );
};

const supportShare = () => {
  return !!navigator.share;
};

function setBackgroundIndex(index: number) {
  imageIndex.value = index;
  generateCanvas();
}

const generateSmallCanvas = async (canvasElement: HTMLCanvasElement, imgSrc: string) => {
  try {
    const context = canvasElement.getContext("2d") as CanvasRenderingContext2D;

    canvasElement.width = 1600;
    canvasElement.height = 900;

    await setSmallBackground(context, imgSrc);
    const metric = await getBuyTextWidth(context);
    roundedRectWhite(context);
    roundedRect(context, {
      radius: 20,
      x: 90,
      y: 230,
      width: metric + 100,
      height: 60
    });
    setArrow(context);
    setBuyText(context);
    setPosition(context);
    setTimeStamp(context);
    setAsset(context);
    setPricePerSymbol(context);

    setLines(context, {
      x: 100,
      y: 450,
      width: 450,
      height: 3
    });
    setLines(context, {
      x: 100,
      y: 582,
      width: 450,
      height: 3
    });
  } catch (e) {
    Logger.error(e);
  }
};

async function setSmallBackground(ctx: CanvasRenderingContext2D, imgSrc: string) {
  const image = new Image();
  const data = await fetch(imgSrc);
  const blob = await data.blob();

  return new Promise<void>((resolve) => {
    image.onload = async () => {
      ctx.drawImage(image, 0, 0, 1600, 900);
      return resolve();
    };

    image.src = window.URL.createObjectURL(blob);
  });
}

const generateCanvas = async () => {
  try {
    const canvasElement = canvas.value as HTMLCanvasElement;
    const context = canvasElement.getContext("2d") as CanvasRenderingContext2D;

    canvasElement.width = 1600;
    canvasElement.height = 900;

    await setBackground(context);
    const metric = await getBuyTextWidth(context);
    roundedRectWhite(context);
    roundedRect(context, {
      radius: 20,
      x: 90,
      y: 230,
      width: metric + 100,
      height: 60
    });
    setArrow(context);
    setBuyText(context);
    setPosition(context);
    setTimeStamp(context);
    setAsset(context);
    setPricePerSymbol(context);

    setLines(context, {
      x: 100,
      y: 450,
      width: 450,
      height: 3
    });
    setLines(context, {
      x: 100,
      y: 582,
      width: 450,
      height: 3
    });
  } catch (e) {
    Logger.error(e);
  }
};

async function setBackground(ctx: CanvasRenderingContext2D) {
  const image = new Image();
  const data = await fetch(images[imageIndex.value]);
  const blob = await data.blob();

  return new Promise<void>((resolve) => {
    image.onload = async () => {
      ctx.drawImage(image, 0, 0, 1600, 900);
      return resolve();
    };

    image.src = window.URL.createObjectURL(blob);
  });
}

function roundedRectWhite(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = colors.white;

  const options = {
    radius: 20,
    x: 50,
    y: 200,
    width: 550,
    height: 500
  };

  ctx.lineJoin = "round";
  ctx.lineWidth = options.radius;
  ctx.strokeStyle = colors.white;
  ctx.fillStyle = colors.white;

  ctx.strokeRect(
    options.x + options.radius * 0.5,
    options.y + options.radius * 0.5,
    options.width - options.radius,
    options.height - options.radius
  );

  ctx.fillRect(
    options.x + options.radius * 0.5,
    options.y + options.radius * 0.5,
    options.width - options.radius,
    options.height - options.radius
  );

  ctx.stroke();
  ctx.fill();
}

function setLines(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
  }
) {
  ctx.fillStyle = colors.white;

  ctx.lineJoin = "round";
  ctx.fillStyle = colors.gray;
  ctx.fillRect(options.x, options.y, options.width, options.height);

  ctx.stroke();
  ctx.fill();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  options: {
    radius: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }
) {
  const num = Number(leaseDisplayData?.pnlPercent.toString(2) ?? "0");

  if (num < 0) {
    ctx.strokeStyle = colors.red;
    ctx.fillStyle = colors.red;
  } else {
    ctx.strokeStyle = colors.green;
    ctx.fillStyle = colors.green;
  }

  ctx.lineJoin = "round";
  ctx.lineWidth = options.radius;

  ctx.strokeRect(
    options.x + options.radius * 0.5,
    options.y + options.radius * 0.5,
    options.width - options.radius,
    options.height - options.radius
  );

  ctx.fillRect(
    options.x + options.radius * 0.5,
    options.y + options.radius * 0.5,
    options.width - options.radius,
    options.height - options.radius
  );

  ctx.stroke();
  ctx.fill();
}

async function setArrow(ctx: CanvasRenderingContext2D) {
  const image = new Image();
  const num = Number(leaseDisplayData?.pnlPercent.toString(2) ?? "0");

  const data = await fetch(num < 0 ? arrowdown : arrowup);
  const blob = await data.blob();

  image.onload = async () => {
    ctx.drawImage(image, 110, 247, 28, 26);
  };

  image.src = window.URL.createObjectURL(blob);
}

async function getBuyTextWidth(ctx: CanvasRenderingContext2D) {
  ctx.font = "600 30px 'Garet'";
  const posType = leaseData ? ProtocolsConfig[leaseData.protocol]?.type : "long";
  return ctx.measureText(
    `${i18n.t(`message.${posType}`)} ${i18n.t("message.buy-position")}`.toUpperCase()
  ).width;
}

async function setBuyText(ctx: CanvasRenderingContext2D) {
  ctx.font = "600 30px 'Garet'";
  ctx.fillStyle = "white";
  const posType = leaseData ? ProtocolsConfig[leaseData.protocol]?.type : "long";
  ctx.fillText(
    `${i18n.t(`message.${posType}`)} ${i18n.t("message.buy-position")}`.toUpperCase(),
    150,
    270
  );
}

async function setAsset(ctx: CanvasRenderingContext2D) {
  const asst = asset()!;
  const image = new Image();
  const data = await fetch(asst.icon);
  const blob = await data.blob();

  image.onload = async () => {
    const rect = 60;
    const hf = rect / image.height;
    const width = hf * image.width;
    ctx.drawImage(image, 100, 310, width, hf * image.height);

    ctx.font = "500 42px 'Garet'";
    ctx.fillStyle = "#082D63";
    if (asst.shortName) {
      ctx.fillText(asst.shortName, 115 + width, 350);
    }
  };

  image.src = window.URL.createObjectURL(blob);
}

function setPricePerSymbol(ctx: CanvasRenderingContext2D) {
  ctx.font = "500 32px 'Garet'";
  ctx.fillStyle = "#5E7699";
  ctx.fillText(
    `${i18n.t("message.price-per-symbol", {
      symbol: asset()?.shortName
    })}: $${currentPrice()}`,
    100,
    405
  );
}

function setPosition(ctx: CanvasRenderingContext2D) {
  const pos = Number(leaseDisplayData?.pnlPercent.toString(2) ?? "0");
  const symbol = pos < 0 ? "-" : "+";
  let [a, d] = Math.abs(pos).toFixed(2).split(".");

  if (pos < 0) {
    ctx.fillStyle = colors.red;
  } else {
    ctx.fillStyle = colors.green;
  }

  const amount = `${symbol}${new Intl.NumberFormat().format(Number(a))}`;

  ctx.font = "600 72px 'Garet'";
  ctx.fillText(amount, 90, 545);

  const w = ctx.measureText(amount).width;

  ctx.font = "600 58px 'Garet'";
  ctx.fillText(`.${d}%`, 90 + w, 545);
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
  ctx.fillStyle = "#5E7699";
  ctx.fillText(`${i18n.t("message.timestamp")}:  ${year}-${month}-${day} ${hours}:${minutes}`, 90, 655);
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
  show: (data: LeaseInfo, displayData?: LeaseDisplayData) => {
    leaseData = data;
    leaseDisplayData = displayData ?? null;
    dialog?.value?.show();
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
