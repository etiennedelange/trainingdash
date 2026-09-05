<!-- src/lib/components/Terminal.svelte -->
<script lang="ts">
  import { get } from 'svelte/store';
  import { gameState } from '$lib/gameState';

  let { open = $bindable(false) }: { open: boolean } = $props();

  type Line = { type: 'cmd' | 'out'; text: string };

  let input = $state('');
  let history = $state<Line[]>([{ type: 'out', text: 'Type "help" to see available commands.' }]);
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (open) setTimeout(() => inputEl?.focus(), 50);
  });

  function close() {
    open = false;
    input = '';
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') submit();
  }

  function submit() {
    const cmd = input.trim();
    if (!cmd) return;
    if (cmd.toLowerCase() === 'clear') {
      history = [];
      input = '';
      return;
    }
    history = [...history, { type: 'cmd', text: `❯ ${cmd}` }, ...runCommand(cmd)];
    input = '';
  }

  function runCommand(raw: string): Line[] {
    const parts = raw.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return [{ type: 'out', text: [
          'Available commands:',
          '  whoami              — about me',
          '  skills              — tech stack',
          '  experience          — work history',
          '  contact             — get in touch',
          '  achievements --list — unlocked achievements',
          '  clear               — clear terminal',
        ].join('\n') }];

      case 'whoami':
        return [{ type: 'out', text: [
          'Etienne de Lange — Software Engineer, Port Elizabeth, South Africa.',
          '15+ years building software across desktop, mobile, web, and cloud.',
          'Currently at Powerfleet, leaning hard into agentic AI engineering.',
          'Firm believer that clean, reviewable code is the foundation of great products.',
          'Cum Laude graduate. Occasional over-engineer. Always curious.',
        ].join('\n') }];

      case 'skills':
        return [{ type: 'out', text: [
          'Cloud & DevOps  — Azure, Azure DevOps, CI/CD, IIS',
          'Backend         — .NET/C#, ASP.NET Core, Entity Framework, SQL, NodeJS',
          'Frontend        — Angular, TypeScript, JavaScript, HTML/CSS, SignalR',
          'Mobile/Desktop  — iOS, Android, Xamarin, WPF, WinForms',
          'AI & Agentic    — GitHub Copilot, Claude Code, AI Agents, Prompt Engineering',
          'Tools           — Git, GitHub, Agile/Scrum, JIRA, VS Code',
        ].join('\n') }];

      case 'experience':
        return [{ type: 'out', text: [
          'Powerfleet          Software Engineer         2023 – Present',
          'MRI Software        Software Engineer III     May 2022 – 2023',
          'LexisNexis          Mid–Senior Engineer       May 2016 – May 2022',
          'Tigers Limited      Mid–Senior Engineer       Nov 2015 – Mar 2016',
          'Property24          Mid-level Engineer        Nov 2014 – Oct 2015',
          'Korbitec            Junior–Mid Engineer       Jan 2011 – Oct 2014',
        ].join('\n') }];

      case 'contact':
        return [{ type: 'out', text: [
          'Email:    etienne.de.lange1@gmail.com',
          'Phone:    +27 76 920 9230',
          'Location: Port Elizabeth, South Africa',
        ].join('\n') }];

      case 'achievements': {
        if (args[0] === '--list') {
          const unlocked = get(gameState.achievements);
          const all = [
            { key: 'dark_knight',     hint: 'toggle dark mode' },
            { key: 'night_owl',       hint: 'visit between 00:00–01:00' },
            { key: 'golden_hour',     hint: 'visit between 16:00–17:00' },
            { key: 'deep_diver',      hint: 'scroll to the very bottom' },
            { key: 'portrait_cycler', hint: 'cycle through all portrait modes' },
            { key: 'time_lord',       hint: 'use the time slider (alt+t)' },
            { key: 'terminal_found',  hint: 'you already found this one' },
            { key: 'skill_stamper',   hint: 'click 5 distinct skill tags' },
            { key: 'logo_tap',        hint: 'click the logo 5× quickly' },
          ];
          const lines = all.map((a) =>
            `${unlocked.includes(a.key) ? '✓' : '○'} ${a.key.padEnd(18)} ${
              unlocked.includes(a.key) ? '(unlocked)' : `hint: ${a.hint}`
            }`
          );
          return [{ type: 'out', text: ['Achievements:', ...lines].join('\n') }];
        }
        return [{ type: 'out', text: 'Usage: achievements --list' }];
      }

      default:
        return [{ type: 'out', text: `command not found: ${cmd}. Type 'help' for available commands.` }];
    }
  }
</script>

{#if open}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="terminal-backdrop"
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === 'Escape' && close()}
>
  <div class="terminal-window" role="dialog" aria-label="Command terminal" aria-modal="true">
    <div class="terminal-header">
      <span class="terminal-title">terminal</span>
      <button class="terminal-close" onclick={close} aria-label="Close terminal">✕</button>
    </div>
    <div class="terminal-output">
      {#each history as line, i (i)}
        <pre class="terminal-line" class:is-cmd={line.type === 'cmd'}>{line.text}</pre>
      {/each}
    </div>
    <div class="terminal-input-row">
      <span class="terminal-prompt">❯</span>
      <input
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleInputKeydown}
        class="terminal-input"
        autocomplete="off"
        spellcheck={false}
        aria-label="Terminal command input"
        placeholder="type a command…"
      />
    </div>
  </div>
</div>
{/if}

<style>
  .terminal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .terminal-window {
    width: 100%;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--c-ink);
    box-shadow: 6px 6px 0 var(--c-shadow);
    background-color: var(--c-bg);
    font-family: 'Space Grotesk', monospace;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 2px solid var(--c-ink);
    background-color: var(--c-bg-alt);
  }

  .terminal-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--c-muted);
  }

  .terminal-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--c-muted);
    padding: 0 0.25rem;
    line-height: 1;
    transition: color 0.15s ease;
  }
  .terminal-close:hover { color: var(--c-ink); }

  .terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-height: 200px;
  }

  .terminal-line {
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    color: var(--c-muted);
    font-family: inherit;
  }

  .terminal-line.is-cmd {
    color: var(--c-accent);
    font-weight: 700;
  }

  .terminal-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-top: 2px solid var(--c-ink);
  }

  .terminal-prompt {
    color: var(--c-accent);
    font-weight: 700;
    font-size: 0.9rem;
    line-height: 1;
  }

  .terminal-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--c-ink);
    caret-color: var(--c-accent);
  }
</style>
