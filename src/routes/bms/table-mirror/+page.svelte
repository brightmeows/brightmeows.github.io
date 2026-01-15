<script lang="ts">
  import { onMount, tick } from "svelte";
  import * as OpenCC from "opencc-js";
  import GroupedTablesSection from "$lib/components/bms/GroupedTablesSection.svelte";
  import SelectedTablesPanel from "$lib/components/bms/SelectedTablesPanel.svelte";
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import FloatingToc, {
    type TocItem,
  } from "$lib/components/FloatingToc.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import { GlassCard, GlassContainer } from "$lib/components/ui";

  interface MirrorTableItem {
    name: string;
    symbol?: string;
    url: string;
    url_ori?: string;
    comment?: string;
    tag1?: string;
    tag2?: string;
    tag_order?: string | number;
    dir_name?: string;
  }

  interface Tag2Group {
    tag2: string;
    items: MirrorTableItem[];
  }

  interface Tag1Group {
    tag1: string;
    order: number;
    subgroups: Tag2Group[];
  }

  interface LinkItem {
    href: string;
    title: string;
    desc: string;
  }

  let loading = true;
  let error: string | null = null;

  let copied = false;

  let tables: MirrorTableItem[] = [];
  let selectedMap: Record<string, boolean> = {};
  let searchQuery = "";
  let tocItems: TocItem[] = [];

  type StringConverter = (input: string) => string;

  const searchConverters: StringConverter[] = (() => {
    try {
      return [
        OpenCC.Converter({ from: "cn", to: "jp" }),
        OpenCC.Converter({ from: "jp", to: "cn" }),
        OpenCC.Converter({ from: "cn", to: "tw" }),
        OpenCC.Converter({ from: "tw", to: "cn" }),
      ];
    } catch {
      return [];
    }
  })();

  function buildSearchNeedles(raw: string): string[] {
    const input = raw.trim();
    if (input.length === 0) return [];

    const normalized = input.normalize("NFKC");
    const needles = new Set<string>();

    const add = (value: string) => {
      const v = value.normalize("NFKC").toLowerCase();
      if (v.length > 0) needles.add(v);
    };

    add(normalized);
    for (const convert of searchConverters) {
      try {
        add(convert(normalized));
      } catch {}
    }

    return Array.from(needles);
  }

  const links: LinkItem[] = [
    { href: "/bms", title: "返回 BMS", desc: "返回 BMS 页面" },
    {
      href: "https://github.com/MiyakoMeow/bms-table-mirror",
      title: "镜像仓库",
      desc: "查看镜像项目",
    },
  ];

  const breadcrumbs = [
    { label: "主页", href: "/" },
    { label: "BMS", href: "/bms" },
    { label: "难度表镜像" },
  ];

  async function copySelected(data: string): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = data;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        await navigator.clipboard.writeText(textarea.value);
        document.body.removeChild(textarea);
      }
    } catch {}
  }

  async function copyTables(): Promise<void> {
    const tablesJsonPath = new URL(
      "/bms/table-mirror/tables.json",
      window.location.origin,
    ).toString();
    await copySelected(tablesJsonPath);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }

  $: normalizedSearch = searchQuery.trim().toLowerCase();
  $: searchNeedles = buildSearchNeedles(searchQuery);
  $: filteredTables = normalizedSearch.length === 0
    ? tables
    : tables.filter((item) => {
      const haystack = [item.name, item.symbol]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join("\n")
        .normalize("NFKC")
        .toLowerCase();
      return searchNeedles.some((needle) => haystack.includes(needle));
    });

  $: groupedByTags = (() => {
    const groupsMap = new Map<
      string,
      { order: number; tag2Map: Map<string, MirrorTableItem[]> }
    >();

    filteredTables.forEach((item) => {
      const tag1 = item.tag1 || "未分类";
      const tag2 = item.tag2 || "其它";
      const orderRaw = item.tag_order;
      const order = typeof orderRaw === "number"
        ? orderRaw
        : parseInt(String(orderRaw || "999"), 10);

      if (!groupsMap.has(tag1)) {
        groupsMap.set(tag1, {
          order,
          tag2Map: new Map<string, MirrorTableItem[]>(),
        });
      } else {
        const existing = groupsMap.get(tag1)!;
        existing.order = Math.min(
          existing.order,
          isNaN(order) ? 999 : order,
        );
      }

      const tag2Map = groupsMap.get(tag1)!.tag2Map;
      if (!tag2Map.has(tag2)) {
        tag2Map.set(tag2, []);
      }

      tag2Map.get(tag2)!.push(item);
    });

    const tag1Groups: Tag1Group[] = Array.from(groupsMap.entries()).map(
      ([tag1, { order, tag2Map }]) => {
        const subgroups: Tag2Group[] = Array.from(tag2Map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([tag2, items]) => ({
            tag2,
            items: items.sort((x, y) =>
              (x.name || "").localeCompare(y.name || "")
            ),
          }));
        return { tag1, order: isNaN(order) ? 999 : order, subgroups };
      },
    );

    tag1Groups.sort((a, b) =>
      a.order - b.order || a.tag1.localeCompare(b.tag1)
    );
    return tag1Groups;
  })();

  function slugifyTag(tag: string): string {
    return tag
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "-");
  }

  $: {
    const tagItems: TocItem[] = groupedByTags.map((g) => ({
      id: `tag1-group-${slugifyTag(g.tag1)}`,
      title: `分类 ${g.tag1}`,
      href: `#tag1-group-${slugifyTag(g.tag1)}`,
      children: g.subgroups.map((sg) => ({
        id: `tag2-group-${slugifyTag(g.tag1)}-${slugifyTag(sg.tag2)}`,
        title: `${sg.tag2} (${sg.items.length})`,
        href: `#tag2-group-${slugifyTag(g.tag1)}-${slugifyTag(sg.tag2)}`,
      })),
    }));

    tocItems = [
      {
        id: "bms-table-mirror",
        title: "BMS 难度表镜像",
        href: "#bms-table-mirror",
      },
      {
        id: "mirror-list",
        title: "镜像列表",
        href: "#mirror-list",
        children: tagItems,
      },
    ];
  }

  async function loadTablesJson(): Promise<void> {
    try {
      const url = new URL(
        "/bms/table-mirror/tables.json",
        window.location.origin,
      ).toString();
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        throw new Error(`无法加载tables.json: ${res.status}`);
      }
      const data = (await res.json()) as unknown;
      if (!Array.isArray(data)) {
        throw new Error("tables.json 格式错误：不是数组");
      }

      tables = (data as MirrorTableItem[]).map((item) => {
        const dir = String(item.dir_name || "").replace(/^\/+|\/+$/g, "");
        if (!dir) return item;
        return { ...item, url: `/bms/table-mirror/${dir}/` };
      });
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "未知错误";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    setTimeout(() => {
      loadTablesJson();
    }, 250);
    tick();
  });
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav
  items={breadcrumbs}
  sessionKey="breadcrumb-bms-table-mirror"
  initiallyOpen={false}
/>
<main class="m-0 mx-auto box-border w-full max-w-350 p-8">
  <GlassContainer
    animate={true}
    class="mt-8 w-full"
  >
    <h1 id="bms-table-mirror" class="page-title mb-2 scroll-mt-5 text-center">
      BMS 难度表镜像
    </h1>

    <div class="mt-2 text-center text-[1.1rem] text-white/70 italic">
      对于BeMusicSeeker用户，可以使用tables.json链接（
      <button
        class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
        type="button"
        on:click={copyTables}
      >
        点击复制
      </button>
      ），导入难度表清单至BeMusicSeeker。
      <a
        class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
        href="https://darksabun.club/table/tablelist.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        使用教程
      </a>
      {#if copied}
        <span class="ml-2 text-[#4caf50]">已复制</span>
      {/if}
    </div>

    <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
      {#each links as link (link.href)}
        <GlassCard
          href={link.href}
          class="w-80 flex flex-col"
        >
          <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">
            {link.title}
          </div>
          <div class="text-[0.95rem] text-white/80">{link.desc}</div>
        </GlassCard>
      {/each}
    </div>
  </GlassContainer>

  <GlassContainer
    id="mirror-list"
    animate={true}
    class="mt-8 w-full scroll-mt-5"
  >
    <div class="flex flex-col gap-3">
      <div class="relative w-full">
        <input
          class="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
          type="text"
          placeholder="按 名称 / 符号 搜索，支持 简体中文 / 繁体中文 / 日文汉字 自动转换"
          bind:value={searchQuery}
        />
        {#if normalizedSearch.length > 0}
          <button
            class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white/20"
            type="button"
            aria-label="清空搜索"
            on:click={() => (searchQuery = "")}
          >
            ×
          </button>
        {/if}
      </div>
      {#if normalizedSearch.length > 0}
        <div class="text-[0.95rem] text-white/60">
          匹配 {filteredTables.length} / {tables.length}
        </div>
      {/if}
    </div>

    {#if loading}
      <div class="mt-6 text-white/80">正在加载镜像列表...</div>
    {:else if error}
      <div class="mt-6 text-red-300">加载失败：{error}</div>
    {:else if groupedByTags.length === 0}
      <div class="mt-6 text-white/70">没有匹配的难度表</div>
    {:else}
      <GroupedTablesSection bind:selectedMap groups={groupedByTags} />
    {/if}
  </GlassContainer>
</main>

<SelectedTablesPanel {tables} {selectedMap} />
<FloatingToc items={tocItems} />
<QuickActions />
