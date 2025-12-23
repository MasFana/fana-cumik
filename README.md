# FanaCumik 

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/svelte--kit-%23FF3E00.svg?style=flat&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/cloudflare%20workers-%23F38020.svg?style=flat&logo=cloudflare&logoColor=white)

**FanaCumik** is a modern, lightweight, and fast manga reader built with SvelteKit and designed for the edge using Cloudflare Workers. It provides a clean, ad-free reading experience with support for multiple manga sources (extensible).

## ✨ Features

- **🚀 Server-Side Rendering (SSR)**: Fast initial load and SEO-friendly pages powered by SvelteKit.
- **📱 Responsive Design**: A mobile-first approach ensuring a great reading experience on any device.
- **🌙 Dark Mode UI**: A sleek, dark-themed interface focused on content consumption.
- **🔄 Multi-Source Support**: Easily extensible architecture to add more manga sources.
- **🕵️ Proxy Support**: Built-in image proxy to bypass CORS restrictions and load images reliably.
- **📜 History Tracking**: Automatically saves your reading progress so you can pick up where you left off.
- **⚡ Edge Ready**: Deployed on Cloudflare Workers for global low-latency access.

## 🛠️ Tech Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Deployment**: [Cloudflare Workers/Pages](https://workers.cloudflare.com/)
- **Icons**: [Lucide Svelte](https://lucide.dev/)

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (recommended package manager)

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/MasFana/cumik.git
    cd cumik
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

3.  **Start the development server**

    ```bash
    pnpm dev
    ```

4.  **Open your browser**
    Navigate to `http://localhost:5173` to see the app running.

## 🤝 Contributing & Extending

We welcome contributions! One of the main ways to contribute is by adding new manga sources.

### Adding a New Source

FanaCumik uses a plugin-like system for sources. To add a new source:

1.  **Create a new file** in `src/lib/server/sources/impl/` (e.g., `MyNewSource.ts`).
2.  **Implement the `BaseSource` class**:

    ```typescript
    import { BaseSource } from '../BaseSource';
    import type { Manga, Chapter, Page } from '../types';

    export default class MyNewSource extends BaseSource {
        constructor() {
            super('my-new-source', 'My New Source', 'https://baseurl.com');
        }

        async getManga(id: string): Promise<Manga> {
            // Implement fetching manga details
        }

        async getChapters(mangaId: string): Promise<Chapter[]> {
            // Implement fetching chapters
        }

        async getPages(chapterId: string): Promise<Page[]> {
            // Implement fetching pages
        }

        async search(query: string): Promise<Manga[]> {
            // Implement search functionality
        }
    }
    ```

3.  **Register the source** in `src/lib/server/sources/index.ts`.

## 📸 Screenshots

### Home Page

![Home Page](https://via.placeholder.com/300x600?text=Home+Page)

### Search Page

![Search Page](https://via.placeholder.com/300x600?text=Search+Page)

### History Page

![History Page](https://via.placeholder.com/300x600?text=History+Page)

### Reading Page

![Reading Page](https://via.placeholder.com/300x600?text=Reading+Page)

### Manga Detail Page

![Manga Detail Page](https://via.placeholder.com/300x600?text=Manga+Detail+Page)


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
