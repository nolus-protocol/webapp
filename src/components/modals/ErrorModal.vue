<template> 
  <div class="block rounded-2xl bg-white md:pb-10 pt-6 pb-[210px] -mt-8 md:mt-auto md:border border-standart shadow-box w-screen md:w-[516px]" @click.stop> 
    <div class="flex flex-col items-center"> 
        <XIcon class="h-14 w-14 bg-light-red/30 radius-circle p-2 text-dark-red z-[2]"/> 
        <h1 class="nls-font-700 text-28 md:text-32 text-primary text-center mt-4 z-[2]"> 
          Error Connecting 
        </h1> 
    </div> 
      
    <div class="separator-line py-6 relative z-[2]"></div> 
    
    <div class="flex flex-col items-center"> 
      <p class="text-18 text-primary text-center nls-font-400 z-[2]"> 
        An unknown error has occurred 
      </p> 
      
      <div class="gap-2 mt-6 hidden md:flex"> 
        <button class="btn btn-primary btn-large-primary" v-on:click="this.tryButton"> 
          Try again 
        </button> 
        
        <button class="btn btn-secondary btn-large-secondary" @click="$emit('close-modal')"> 
          Cancel 
        </button> 
      </div> 
      
      <div class="bg-white h-[430px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div> 
      
      <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal"> 
        <button class="btn btn-primary btn-large-primary mr-4 w-40" v-on:click="this.tryButton"> 
          Try again 
        </button> 
        
        <button class="btn btn-secondary btn-large-secondary w-40" @click="$emit('close-modal')"> 
          Cancel 
        </button> 
      </div> 
    </div> 
  </div> 
</template>

<script lang="ts">
import { CheckIcon } from '@heroicons/vue/solid'

export default {
  name: 'ErrorModal',
  components: {
    CheckIcon
  },
  props: {
    tryButton: {
      type: Function
    }
  }
}
</script>
