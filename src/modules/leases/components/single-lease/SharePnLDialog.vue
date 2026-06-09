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
            <div class="flex flex-wrap justify-start gap-3">
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
import { Button, Checkbox, Dialog } from "web-components";
import { useSharePnLDialog } from "./useSharePnLDialog";

const {
  dialog,
  canvas,
  canvasRefs,
  images,
  imageIndex,
  showPnlAmount,
  showPrice,
  showPositionSize,
  setBackgroundIndex,
  supportShare,
  share,
  download,
  show
} = useSharePnLDialog();

defineExpose({ show });
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
