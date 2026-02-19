<script lang="ts">
  import FloatingPanel from "./FloatingPanel.svelte";
  import { GlassButton } from "./ui";
</script>

<FloatingPanel
  sessionKey="miyakomeow_profile_card_seen"
  initiallyOpen={true}
  position="top-left"
  size="large"
  ariaLabel="个人信息卡片"
>
  {#snippet icon()}
    <img
      class="size-11 rounded-full border-2 border-white/30"
      src="https://github.com/MiyakoMeow.png"
      alt="Miyako Meow"
    />
  {/snippet}

  <div class="text-center">
    <div>
      <div>
        <img
          class="mx-auto mb-4 h-30 w-30 rounded-full border-4 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform duration-300 ease-in-out hover:scale-105 hover:rotate-[5deg]"
          src="https://github.com/MiyakoMeow.png"
          alt="Miyako Meow"
        />
      </div>
      <h1
        class="my-2 bg-[linear-gradient(90deg,#a78bfa,#f472b6,#60a5fa)] bg-clip-text text-[2.5rem] text-transparent"
      >
        MiyakoMeow
      </h1>
      <p class="mb-8 text-[1.1rem] text-[#a5b4fc]">喵喵喵！</p>
    </div>

    <div class="mb-10 leading-[1.6] text-white/90">
      <p>追逐成就感中</p>
    </div>

    <div class="flex flex-wrap justify-center gap-4">
      <GlassButton href="https://github.com/MiyakoMeow" target="_blank">GitHub</GlassButton>
      <GlassButton href="https://space.bilibili.com/215242890">Bilibili</GlassButton>
      <GlassButton href="https://x.com/MiyakoWoW">X (Twitter)</GlassButton>
    </div>
  </div>
</FloatingPanel>
