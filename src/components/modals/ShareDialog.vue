<template>
  <DialogHeader :headerList="[$t('message.share')]">
    <div class="container p-8">
      <canvas ref="canvas"></canvas>
      <div class="flex">
        <button class="btn btn-primary btn-large-primary flex-1">{{ $t('message.share') }}</button>
        <button class="btn btn-secondary btn-large-secondary flex-1">{{ $t('message.download') }}</button>
      </div>
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import { onMounted, ref } from "vue";

const canvas = ref<HTMLCanvasElement>()

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
  }
})

onMounted(() => {
  generateCanvas()
})

const generateCanvas = async () => {
  try {

    const canvasElement = canvas.value as HTMLCanvasElement;
    const context = canvasElement.getContext('2d') as CanvasRenderingContext2D;

    canvasElement.width = 1600;
    canvasElement.height = 900;


    await setBackground(context);
    roundedRect(context, {
      radius: 20,
      color: '#1AB171',
      x: 90,
      y: 230,
      width: 300,
      height: 60
    });
    setArrow(context);
    setBuyText(context);
    setPosition(context);
    setTimeStamp(context);
    setAsset(context);
    setPricePerAtom(context)

  } catch (e) {
    console.log(e)
  }

  async function setBackground(ctx: CanvasRenderingContext2D) {
    const image = new Image();

    return new Promise<void>((resolve) => {
      image.onload = async () => {
        ctx.drawImage(image, 0, 0, 1600, 900);
        return resolve();
      };

      image.src = '/share_image.svg';
    });

  }

  function roundedRect(ctx: CanvasRenderingContext2D, options: {
    color: string,
    radius: number,
    x: number,
    y: number,
    width: number,
    height: number
  }) {
    ctx.strokeStyle = options.color;
    ctx.fillStyle = options.color;
    ctx.lineJoin = "round";
    ctx.lineWidth = options.radius;

    ctx.strokeRect(
      options.x + (options.radius * .5),
      options.y + (options.radius * .5),
      options.width - options.radius,
      options.height - options.radius
    );

    ctx.fillRect(
      options.x + (options.radius * .5),
      options.y + (options.radius * .5),
      options.width - options.radius,
      options.height - options.radius
    );

    ctx.stroke();
    ctx.fill();
  }

  async function setArrow(ctx: CanvasRenderingContext2D) {
    const image = new Image();

    image.onload = async () => {
      ctx.drawImage(image, 100, 240, 36, 33);
    };

    image.src = '/arrowup.svg';
  }

  async function setBuyText(ctx: CanvasRenderingContext2D) {
    ctx.font = "bold 30px 'Garet Bolder'";
    ctx.fillStyle = 'white';
    ctx.fillText("BUY POSITION", 150, 270);
  }

  async function setAsset(ctx: CanvasRenderingContext2D) {
    const image = new Image();

    image.onload = async () => {
      const rect = 60;
      const hf = rect / image.height;
      const width = hf * image.width;
      ctx.drawImage(image, 100, 310, width, hf * image.height);

      ctx.font = "500 42px 'Garet-Medium'";
      ctx.fillStyle = '#082D63';
      ctx.fillText("ATOM", 115 + width, 350);

    };

    image.src = props.icon;
  }

  function setPricePerAtom(ctx: CanvasRenderingContext2D) {
    ctx.font = "500 32px 'Garet-Medium'";
    ctx.fillStyle = '#5E7699';
    ctx.fillText("Price per АТОМ: $29,345.00", 100, 405);
  }

  function setPosition(ctx: CanvasRenderingContext2D) {
    ctx.font = "700 84px 'Garet Bolder'";
    ctx.fillStyle = '#1AB171';
    ctx.fillText("+1,131", 90, 535);

    const w = ctx.measureText("+1,131").width;

    ctx.font = "700 64px 'Garet Bolder'";
    ctx.fillStyle = '#1AB171';
    ctx.fillText(".13%", 90 + w, 535);
  }

  function setTimeStamp(ctx: CanvasRenderingContext2D) {
    ctx.font = "500 32px 'Garet-Medium'";
    ctx.fillStyle = '#5E7699';
    ctx.fillText("TIMESTAMP:  2023-07-03 12:34", 90, 655);
  }

}
</script>
<style lang="scss">
canvas {
  height: auto;
  width: 100%;
  border-radius: 12px;
}
</style>