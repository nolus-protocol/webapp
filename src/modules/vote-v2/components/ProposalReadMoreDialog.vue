<template>
  <DialogHeader :headerList="[title]">
    <div
      class="custom-scroll proposal-modal w-full overflow-auto p-10 text-left text-neutral-typography-200 md:max-h-[70vh]"
      v-html="description"
    ></div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { marked } from "marked";
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true
  }
});

const description = computed(() => {
  return marked.parse(props.source, {
    pedantic: true,
    gfm: true,
    breaks: true
  });
});
</script>

<style lang="scss">
.proposal-modal {
  p {
    text-align: left;
    font-size: 14px;
    margin-bottom: 18px;

    &.strong {
      font-weight: 600;
    }
  }

  ul {
    margin-bottom: 18px;
    list-style: unset;
  }

  h1 {
    text-align: left;
    font-weight: 700;
    font-size: 18px;
    margin-bottom: 18px;
  }

  h2 {
    text-align: left;
    font-weight: 700;
    font-size: 14px;
  }

  a {
    transition: ease 200ms;
    color: #2868e1;

    &.link {
      color: #2868e1;
    }
  }

  a:hover {
    color: #2868e1;
  }
}
</style>
