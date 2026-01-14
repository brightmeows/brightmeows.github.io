import type { Plugin } from "vite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Vite 插件：自动为 GitHub Pages 创建 .nojekyll 文件
 *
 * GitHub Pages 默认使用 Jekyll 处理网站，Jekyll 会忽略所有
 * 以下划线开头的文件和目录（如 _app）。这会导致 SvelteKit
 * 构建的资源文件无法被访问。
 *
 * 此插件在构建完成后自动在输出目录创建 .nojekyll 文件，
 * 禁用 Jekyll 处理，确保所有文件正常访问。
 */
export function nojekyllPlugin(): Plugin {
	return {
		name: "vite-plugin-nojekyll",

		// 在构建完成后创建 .nojekyll 文件
		closeBundle() {
			const outDir = "build"; // 与 svelte.config.ts 中 adapter 配置一致
			const nojekyllPath = join(process.cwd(), outDir, ".nojekyll");

			try {
				writeFileSync(nojekyllPath, "");
				console.log("✅ Created .nojekyll file for GitHub Pages");
			} catch (error) {
				console.error("❌ Failed to create .nojekyll file:", error);
			}
		},
	};
}
