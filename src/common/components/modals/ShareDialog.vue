<template>
  <DialogHeader :headerList="[$t('message.share')]">
    <div class="container">
      <canvas ref="canvas"></canvas>
      <div class="mt-8 flex gap-[12px]">
        <Button
          v-if="supportShare()"
          :label="$t('message.share')"
          class="flex-1"
          severity="primary"
          size="large"
          @click="share()"
        />
        <Button
          :label="$t('message.download')"
          class="flex-1"
          severity="secondary"
          size="large"
          @click="download()"
        />
      </div>
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import arrowup from "@/assets/icons/arrowup.svg";
import arrowdown from "@/assets/icons/arrowdown.svg";
import shareImage from "@/assets/icons/share_image.svg";

import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Logger } from "@/common/utils";
import { Button } from "web-components";

const i18n = useI18n();
const colors = {
  red: "#E42929",
  green: "#1AB171"
};

const canvas = ref<HTMLCanvasElement>();

const props = defineProps({
  icon: {
    type: String,
    required: true
  },
  asset: {
    type: String,
    required: true
  },
  price: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true
  },
  positionType: {
    type: String,
    required: true
  }
});

onMounted(() => {
  generateCanvas();
});

const supportShare = () => {
  return !!navigator.share;
};

const generateCanvas = async () => {
  try {
    const canvasElement = canvas.value as HTMLCanvasElement;
    const context = canvasElement.getContext("2d") as CanvasRenderingContext2D;

    canvasElement.width = 1600;
    canvasElement.height = 900;

    await setBackground(context);
    const metric = await getBuyTextWidth(context);
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
    setPricePerAtom(context);
  } catch (e) {
    Logger.error(e);
  }

  async function setBackground(ctx: CanvasRenderingContext2D) {
    const image = new Image();
    const data = await fetch(shareImage);
    const blob = await data.blob();

    return new Promise<void>((resolve) => {
      image.onload = async () => {
        ctx.drawImage(image, 0, 0, 1600, 900);
        return resolve();
      };

      image.src = window.URL.createObjectURL(blob);
    });
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
    const num = Number(props.position);

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
    const num = Number(props.position);

    const data = await fetch(num < 0 ? arrowdown : arrowup);
    const blob = await data.blob();

    image.onload = async () => {
      ctx.drawImage(image, 110, 247, 28, 26);
    };

    image.src = window.URL.createObjectURL(blob);
  }

  async function getBuyTextWidth(ctx: CanvasRenderingContext2D) {
    ctx.font = "bold 30px 'Garet-Medium'";
    return ctx.measureText(`${i18n.t(`message.${props.positionType}`)} ${i18n.t("message.buy-position")}`.toUpperCase())
      .width;
  }

  async function setBuyText(ctx: CanvasRenderingContext2D) {
    ctx.font = "bold 30px 'Garet-Medium'";
    ctx.fillStyle = "white";
    ctx.fillText(
      `${i18n.t(`message.${props.positionType}`)} ${i18n.t("message.buy-position")}`.toUpperCase(),
      150,
      270
    );
  }

  async function setAsset(ctx: CanvasRenderingContext2D) {
    const image = new Image();
    const data = await fetch(props.icon);
    const blob = await data.blob();

    image.onload = async () => {
      const rect = 60;
      const hf = rect / image.height;
      const width = hf * image.width;
      ctx.drawImage(image, 100, 310, width, hf * image.height);

      ctx.font = "500 42px 'Garet-Medium'";
      ctx.fillStyle = "#082D63";
      ctx.fillText(props.asset, 115 + width, 350);
    };

    image.src = window.URL.createObjectURL(blob);
  }

  function setPricePerAtom(ctx: CanvasRenderingContext2D) {
    ctx.font = "500 32px 'Garet-Medium'";
    ctx.fillStyle = "#5E7699";
    ctx.fillText(
      `${i18n.t("message.price-per-symbol", {
        symbol: props.asset
      })}: ${props.price}`,
      100,
      405
    );
  }

  function setPosition(ctx: CanvasRenderingContext2D) {
    const pos = Number(props.position);
    const symbol = pos < 0 ? "-" : "+";
    let [a, d] = Math.abs(pos).toFixed(2).split(".");

    if (pos < 0) {
      ctx.fillStyle = colors.red;
    } else {
      ctx.fillStyle = colors.green;
    }

    const amount = `${symbol}${new Intl.NumberFormat().format(Number(a))}`;

    ctx.font = "700 72px 'Garet-Medium'";
    ctx.fillText(amount, 90, 545);

    const w = ctx.measureText(amount).width;

    ctx.font = "700 58px 'Garet-Medium'";
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

    ctx.font = "500 32px 'Garet-Medium'";
    ctx.fillStyle = "#5E7699";
    ctx.fillText(`${i18n.t("message.timestamp")}:  ${year}-${month}-${day} ${hours}:${minutes}`, 90, 655);
  }
};

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
</script>
<style lang="scss">
canvas {
  height: auto;
  width: 100%;
  border-radius: 12px;
}
</style>
