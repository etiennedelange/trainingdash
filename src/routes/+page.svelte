<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import DotGrid from '$lib/components/DotGrid.svelte';
	import { applyTimePalette } from '$lib/timeTheme.js';
	import { gameState } from '$lib/gameState';
	import { countUp } from '$lib/actions/countUp';
	import { stamp } from '$lib/actions/stamp';
	import Terminal from '$lib/components/Terminal.svelte';

	let menuOpen = $state(false);
	let scrolled = $state(false);
	let isDark = $state(browser && document.documentElement.classList.contains('dark'));
	let testHour = $state<number | null>(null);
	let sliderVisible = $state(false);
	let grainOpacity = $state(0.35);
	let portraitReady = $state(false);
	let terminalOpen = $state(false);
	let scrollProgress = $state(0);
	let footerSecretVisible = $state(false);
	let portraitMode = $state<0 | 1 | 2 | 3>(0);
	let portraitCycled = $state(false);
	let stampedSkills = $state(new Set<string>());
	let logoTapCount = $state(0);
	let logoTapTimer: ReturnType<typeof setTimeout> | null = null;
	let logoMessage = $state('');

	function handleKeydown(e: KeyboardEvent) {
		if (e.altKey && e.key === 't') sliderVisible = !sliderVisible;

		const tag = (e.target as HTMLElement).tagName;
		const editable = (e.target as HTMLElement).isContentEditable;
		if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !editable) {
			e.preventDefault();
			if (!terminalOpen) {
				terminalOpen = true;
				gameState.unlock('terminal_found');
			}
		}
	}

	const timeLabel = $derived(
		testHour === null
			? 'Real time'
			: `${String(Math.floor(testHour)).padStart(2, '0')}:${String(Math.round((testHour - Math.floor(testHour)) * 60)).padStart(2, '0')}`
	);

	$effect(() => {
		const hour = testHour ?? (new Date().getHours() + new Date().getMinutes() / 60);
		applyTimePalette(hour, isDark);

		if (testHour !== null) return;
		const interval = setInterval(() => {
			applyTimePalette(new Date().getHours() + new Date().getMinutes() / 60, isDark);
		}, 60_000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (testHour !== null) gameState.unlock('time_lord');
	});

	$effect(() => {
		document.body.style.overflow = terminalOpen ? 'hidden' : '';
	});

	const navItems = [
		{ id: 'about', label: 'About' },
		{ id: 'experience', label: 'Experience' },
		{ id: 'skills', label: 'Skills' },
		{ id: 'education', label: 'Education' },
		{ id: 'contact', label: 'Contact' }
	];

	const experiences = [
		{
			company: 'Powerfleet',
			role: 'Software Engineer',
			period: '2023 – Present',
			tech: ['GitHub Copilot', 'AI Agents', 'Claude Code', 'Agentic Engineering', 'GitHub', 'TypeScript'],
			highlights: [
				'Adopted GitHub Copilot CLI and AI-assisted tooling to accelerate development workflows.',
				'Built and iterated on custom agents and skills within agentic engineering frameworks.',
				'Deepened expertise in the agentic engineering approach — designing systems where AI agents handle discrete tasks end-to-end.'
			]
		},
		{
			company: 'MRI Software',
			role: 'Software Engineer III',
			period: 'May 2022 – 2023',
			tech: ['Azure', '.NET', 'C#', 'ASP.NET MVC', 'Umbraco', 'GitHub', 'Azure DevOps', 'SQL'],
			highlights: [
				'Developed new features and fixed bugs across a cloud-based real estate software platform.',
				'Conducted code reviews via GitHub pull requests to maintain quality standards.',
				'Sprint planning and tracking with JIRA in an agile team.'
			]
		},
		{
			company: 'LexisNexis',
			role: 'Mid – Senior Software Engineer',
			period: 'May 2016 – May 2022',
			tech: ['.NET 6', 'C#', 'Angular', 'AngularJS', 'TypeScript', 'SQL', 'Azure DevOps', 'Entity Framework', 'SignalR'],
			highlights: [
				'Built and maintained a market-leading conveyancing management system used by banks and attorneys.',
				'Sole developer of an internal admin website using .NET Core, Angular 13, SignalR, and Azure DevOps CI/CD pipelines.',
				'Mentored junior developers and ran check-in reviews to enforce code quality.',
				'Managed Azure DevOps build and release pipelines for continuous integration and deployment.'
			]
		},
		{
			company: 'Tigers Limited',
			role: 'Mid – Senior Software Engineer',
			period: 'Nov 2015 – Mar 2016',
			tech: ['.NET', 'C#', 'AngularJS', 'ASP.NET Web API', 'ASP.NET Identity', 'SQL', 'TFS'],
			highlights: [
				'Developed a warehouse orders portal enabling complex stock queries for a global logistics provider.',
				'Built a VSTO add-in for Microsoft Outlook.'
			]
		},
		{
			company: 'Property24',
			role: 'Mid-level Software Engineer',
			period: 'Nov 2014 – Oct 2015',
			tech: ['C#', 'Java', 'Android', 'iOS', 'Xamarin', 'SQLite', 'OrmLite'],
			highlights: [
				'Developed and maintained iOS and Android property listing applications with search, favourites, and agent contact features.',
				'Participated in user experience sessions to improve usability.'
			]
		},
		{
			company: 'Korbitec',
			role: 'Junior – Mid Software Engineer',
			period: 'Jan 2011 – Oct 2014',
			tech: ['.NET', 'C#', 'WPF', 'WinForms', 'SQL', 'LINQ', 'TortoiseSVN'],
			highlights: [
				'Contributed to a desktop back-office solution for estate agents managing property listings and sales.',
				'Built reporting components using SQL views and WPF/WinForms.',
				'Involved in the full SDLC from analysis and design through to deployment.'
			]
		}
	];

	const skillGroups = [
		{
			label: 'Cloud & DevOps',
			skills: ['Microsoft Azure', 'Azure DevOps', 'IIS', 'CI/CD Pipelines']
		},
		{
			label: 'Backend',
			skills: ['.NET / .NET Core', 'C#', 'ASP.NET Core', 'ASP.NET MVC', 'ASP.NET Web API', 'Entity Framework', 'LINQ', 'SQL', 'WCF', 'NodeJS']
		},
		{
			label: 'Frontend',
			skills: ['Angular', 'AngularJS', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SignalR', 'Umbraco']
		},
		{
			label: 'Mobile & Desktop',
			skills: ['iOS', 'Android', 'Xamarin', 'WPF', 'WinForms', 'Java']
		},
		{
			label: 'AI & Agentic',
			skills: ['GitHub Copilot', 'Claude Code', 'AI Agents', 'Agentic Engineering', 'Prompt Engineering']
		},
		{
			label: 'Tools & Process',
			skills: ['Git', 'GitHub', 'Agile / Scrum', 'JIRA', 'Trello', 'Visual Studio', 'VS Code', 'SQL Server Management Studio']
		}
	];

	const education = [
		{
			degree: 'Baccalaureus Technologiae: Information Technology',
			institution: 'Nelson Mandela Metropolitan University',
			location: 'Port Elizabeth, South Africa',
			year: '2009 – 2010',
			note: 'Cum Laude'
		},
		{
			degree: 'National Diploma: Information Technology',
			institution: 'Nelson Mandela Metropolitan University',
			location: 'Port Elizabeth, South Africa',
			year: '2006 – 2009',
			note: ''
		}
	];

	const certifications = [
		{ title: 'Microsoft Certified: Azure Fundamentals', year: '2023', highlight: true },
		{ title: 'Exam 480: Programming in HTML5 with JavaScript and CSS3', year: '2018', highlight: false },
		{ title: 'Merit Award for Academic Excellence (3rd Level, Nov Examination)', year: '2009', highlight: false },
		{ title: 'Merit Award for Academic Excellence in Final Year Project', year: '2009', highlight: false },
		{ title: 'Top 3rd Year Project', year: '2009', highlight: true },
		{ title: 'Attended Imagine Cup South Africa', year: '2009', highlight: false }
	];

	onMount(() => {
		portraitReady = true;

		// Console easter egg
		console.log(
			'%c╔══════════════════════════════════╗\n' +
			"║   Hi, I'm Etienne de Lange       ║\n" +
			'║   Software Engineer              ║\n' +
			'╚══════════════════════════════════╝',
			'color: #f5d90a; font-family: monospace; font-size: 13px;'
		);
		console.log(
			'%cCurious about the source? Try pressing / anywhere.',
			'color: #6b7280; font-size: 12px;'
		);

		// Time-based achievements
		const hour = new Date().getHours();
		if (hour === 0) gameState.unlock('night_owl');
		if (hour === 16) gameState.unlock('golden_hour');

		// Scroll listener
		const handleScroll = () => {
			scrolled = window.scrollY > 40;
			const maxScroll = document.body.scrollHeight - window.innerHeight;
			scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
			if (
				!footerSecretVisible &&
				window.scrollY + window.innerHeight >= document.body.scrollHeight - 4
			) {
				footerSecretVisible = true;
				gameState.unlock('deep_diver');
			}
		};
		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => window.removeEventListener('scroll', handleScroll);
	});

	function toggleDark() {
		isDark = !isDark;
		document.documentElement.classList.toggle('dark', isDark);
		localStorage.setItem('theme', isDark ? 'dark' : 'light');
		gameState.unlock('dark_knight');
	}

	function handleSkillStamp(skill: string) {
		if (stampedSkills.has(skill)) return;
		stampedSkills = new Set([...stampedSkills, skill]);
		if (stampedSkills.size >= 5) gameState.unlock('skill_stamper');
	}

	function cyclePortrait() {
		portraitMode = ((portraitMode + 1) % 4) as 0 | 1 | 2 | 3;
		if (portraitMode === 0 && !portraitCycled) {
			portraitCycled = true;
			gameState.unlock('portrait_cycler');
		}
	}

	function handleLogoClick(e: MouseEvent) {
		logoTapCount++;
		if (logoTapTimer) clearTimeout(logoTapTimer);
		logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 2000);

		if (logoTapCount >= 5) {
			e.preventDefault();
			logoTapCount = 0;
			clearTimeout(logoTapTimer!);
			logoTapTimer = null;
			gameState.unlock('logo_tap');
			logoMessage = 'Loading…';
			setTimeout(() => {
				logoMessage = 'Still loading personality… just kidding.';
				setTimeout(() => { logoMessage = ''; }, 2500);
			}, 700);
		}
	}

	function scrollTo(id: string) {
		menuOpen = false;
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>Etienne de Lange – Software Engineer</title>
</svelte:head>

<!-- NAV -->
<header
	class="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
	style:background-color={scrolled ? 'var(--c-bg)' : 'transparent'}
	style:border-bottom={scrolled ? '2px solid var(--c-ink)' : 'none'}
>
	<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
		<div class="logo-wrap">
			<a
				href="/"
				onclick={handleLogoClick}
				class="text-lg font-bold tracking-tight hover:opacity-70 transition-opacity"
				style="color: var(--c-ink);"
			>
				Etienne<span style="color: var(--c-accent);" class="ml-1">.</span>
			</a>
			{#if logoMessage}
				<div class="logo-tooltip">{logoMessage}</div>
			{/if}
		</div>

		<!-- Desktop nav -->
		<ul class="hidden md:flex items-center gap-8">
			{#each navItems as item (item.id)}
				<li>
					<button
						onclick={() => scrollTo(item.id)}
						class="text-sm font-medium transition-colors cursor-pointer hover:opacity-100"
						style="color: var(--c-muted);"
						onmouseenter={(e) => (e.currentTarget.style.color = 'var(--c-ink)')}
						onmouseleave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}
					>
						{item.label}
					</button>
				</li>
			{/each}
			<li>
				<!-- Dark mode toggle -->
				<button
					class="dm-toggle"
					onclick={toggleDark}
					aria-pressed={isDark}
					aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
				>
					<span class="theme-icon" class:is-dark={isDark} aria-hidden="true">
						<svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<circle cx="12" cy="12" r="4.5"/>
							<line x1="12" y1="2" x2="12" y2="5"/>
							<line x1="12" y1="19" x2="12" y2="22"/>
							<line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
							<line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
							<line x1="2" y1="12" x2="5" y2="12"/>
							<line x1="19" y1="12" x2="22" y2="12"/>
							<line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
							<line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
						</svg>
						<svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
						</svg>
					</span>
				</button>
			</li>
			<li>
				<a
					href="mailto:etienne.de.lange1@gmail.com"
					class="neo-btn px-4 py-2 text-sm inline-block"
					style="background-color: var(--c-accent); color: #0a0a0a;"
				>
					Hire me
				</a>
			</li>
		</ul>

		<!-- Mobile hamburger -->
		<button
			class="md:hidden flex flex-col gap-1.5 p-2 cursor-pointer"
			onclick={() => (menuOpen = !menuOpen)}
			aria-label="Toggle menu"
		>
			<span
				class="block w-6 h-0.5 transition-all"
				style="background-color: var(--c-ink);"
				class:rotate-45={menuOpen}
				class:translate-y-2={menuOpen}
			></span>
			<span
				class="block w-6 h-0.5 transition-all"
				style="background-color: var(--c-ink);"
				class:opacity-0={menuOpen}
			></span>
			<span
				class="block w-6 h-0.5 transition-all"
				style="background-color: var(--c-ink);"
				class:-rotate-45={menuOpen}
				class:-translate-y-2={menuOpen}
			></span>
		</button>
	</nav>

	<!-- Mobile menu -->
	{#if menuOpen}
		<div
			class="md:hidden px-6 py-4 flex flex-col gap-4"
			style="background-color: var(--c-bg); border-top: 2px solid var(--c-ink);"
		>
			{#each navItems as item (item.id)}
				<button
					onclick={() => scrollTo(item.id)}
					class="text-left text-sm font-medium cursor-pointer"
					style="color: var(--c-muted);"
				>
					{item.label}
				</button>
			{/each}
			<div class="flex items-center gap-3 pt-1">
				<button
					class="dm-toggle"
					onclick={toggleDark}
					aria-pressed={isDark}
					aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
				>
					<span class="theme-icon" class:is-dark={isDark} aria-hidden="true">
						<svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<circle cx="12" cy="12" r="4.5"/>
							<line x1="12" y1="2" x2="12" y2="5"/>
							<line x1="12" y1="19" x2="12" y2="22"/>
							<line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
							<line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
							<line x1="2" y1="12" x2="5" y2="12"/>
							<line x1="19" y1="12" x2="22" y2="12"/>
							<line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
							<line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
						</svg>
						<svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
						</svg>
					</span>
				</button>
				<a
					href="mailto:etienne.de.lange1@gmail.com"
					class="neo-btn px-4 py-2 text-sm inline-block"
					style="background-color: var(--c-accent); color: #0a0a0a;"
				>
					Hire me
				</a>
			</div>
		</div>
	{/if}
	<div class="scroll-progress" style:width="{scrollProgress * 100}%"></div>
</header>

<main>
<!-- HERO -->
<section id="hero" class="relative min-h-screen overflow-hidden">
	<DotGrid testHour={testHour ?? undefined} />
	<div class="relative z-10 flex flex-col justify-center px-6 pt-24 pb-16 max-w-6xl mx-auto min-h-screen">
		<div class="grid lg:grid-cols-[1fr_auto] gap-12 xl:gap-20 items-center">
			<!-- Text content -->
			<div>
				<p class="text-sm font-semibold uppercase tracking-widest mb-6" style="color: var(--c-muted);">
					Software Engineer · Port Elizabeth, South Africa
				</p>

				<h1 class="text-6xl sm:text-7xl font-bold leading-none tracking-tight mb-6">
					Etienne<br />
					<span class="relative inline-block">
						de Lange
						<span
							class="absolute -bottom-2 left-0 right-0 h-4 -z-10"
							style="background-color: var(--c-accent);"
						></span>
					</span>
				</h1>

				<p class="text-lg md:text-xl max-w-xl leading-relaxed mt-8 mb-10" style="color: var(--c-muted);">
					15+ years crafting robust software — from conveyancing systems and property apps
					to microservices on Azure and agentic AI engineering. I take pride in every line of code.
				</p>

				<div class="flex flex-wrap gap-4">
					<button
						onclick={() => scrollTo('experience')}
						class="neo-btn px-6 py-3 font-semibold"
						style="background-color: var(--c-accent); color: #0a0a0a;"
					>
						View Experience
					</button>
					<button
						onclick={() => scrollTo('contact')}
						class="neo-btn px-6 py-3 font-semibold"
						style="background-color: var(--c-bg);"
					>
						Get in touch
					</button>
				</div>
			</div>

			<!-- Portrait -->
			<div class="hidden lg:block self-center">
				<div class="relative inline-block">
					<div
						class="absolute inset-0"
						style="background-color: var(--c-accent); transform: translate(6px, 6px);"
					></div>
					<div
						class="portrait-frame w-56 xl:w-64"
						class:portrait-mode-contrast={portraitMode === 1}
						class:portrait-mode-glitch={portraitMode === 2}
						class:portrait-mode-scanlines={portraitMode === 3}
						onclick={cyclePortrait}
						role="button"
						tabindex="0"
						aria-label="Cycle portrait filter"
						onkeydown={(e) => e.key === 'Enter' && cyclePortrait()}
					>
						<div class="portrait-duo" class:transitions-on={portraitReady}>
							<img src="/image.png" alt="Etienne de Lange" class="portrait-img" width="545" height="553" fetchpriority="high" />
						</div>
						<div class="portrait-grain" style:opacity={grainOpacity}></div>
						<div class="portrait-lines"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Stats row -->
		<div class="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6">
			{#each [
				{ value: '15+', label: 'Years experience' },
				{ value: '6', label: 'Companies' },
				{ value: '2', label: 'Certifications' },
				{ value: 'Cum Laude', label: 'Graduate' }
			] as stat (stat.label)}
				<div class="pt-4" style="border-top: 2px solid var(--c-ink);">
					<p class="text-3xl font-bold" use:countUp={{ target: stat.value }}>{stat.value}</p>
					<p class="text-sm mt-1" style="color: var(--c-muted);">{stat.label}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- ABOUT -->
<section id="about" class="py-24 px-6" style="background-color: var(--c-bg-alt);">
	<div class="max-w-6xl mx-auto">
		<div class="grid md:grid-cols-2 gap-16 items-start">
			<div>
				<p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: var(--c-muted);">
					01 / About
				</p>
				<h2 class="text-4xl md:text-5xl font-bold leading-tight mb-8">
					Passionate about<br />great software.
				</h2>
				<div class="relative inline-block lg:hidden">
					<div
						class="absolute inset-0"
						style="background-color: var(--c-accent); transform: translate(5px, 5px);"
					></div>
					<div
						class="portrait-frame w-40"
						class:portrait-mode-contrast={portraitMode === 1}
						class:portrait-mode-glitch={portraitMode === 2}
						class:portrait-mode-scanlines={portraitMode === 3}
						onclick={cyclePortrait}
						role="button"
						tabindex="0"
						aria-label="Cycle portrait filter"
						onkeydown={(e) => e.key === 'Enter' && cyclePortrait()}
					>
						<div class="portrait-duo" class:transitions-on={portraitReady}>
							<img src="/image.png" alt="Etienne de Lange" class="portrait-img" width="545" height="553" fetchpriority="high" />
						</div>
						<div class="portrait-grain" style:opacity={grainOpacity}></div>
						<div class="portrait-lines"></div>
					</div>
				</div>
			</div>
			<div class="space-y-5 leading-relaxed" style="color: var(--c-muted);">
				<p>
					I started my career in January 2011 and have since worked across desktop applications,
					mobile platforms, web portals, and cloud-based microservices — always focused on delivering
					quality and going the extra mile.
				</p>
				<p>
					At LexisNexis I was the sole architect of an internal admin platform, setting up full CI/CD
					pipelines in Azure DevOps from scratch. At MRI Software I deepened my Azure expertise,
					developing microservices that power real estate management at scale.
				</p>
				<p>
					Now at Powerfleet, I'm embracing the agentic engineering era — building and working with
					AI agents, leveraging GitHub Copilot CLI, and adopting the next generation of AI-assisted
					developer workflows.
				</p>
				<p>
					Agile methodologies, code reviews, and mentoring junior developers have been constants
					throughout my career. I believe that clean, reviewable code is the foundation of every
					great product.
				</p>
				<div class="flex flex-wrap gap-2 pt-2">
					{#each ['Problem Solver', 'Team Player', 'Mentor', 'Agile Practitioner'] as trait (trait)}
						<span class="neo-tag">{trait}</span>
					{/each}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- EXPERIENCE -->
<section id="experience" class="py-24 px-6">
	<div class="max-w-6xl mx-auto">
		<p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: var(--c-muted);">
			02 / Experience
		</p>
		<h2 class="text-4xl md:text-5xl font-bold mb-16">Where I've worked.</h2>

		<div class="space-y-8">
			{#each experiences as job (job.company)}
				<div class="neo-card p-8">
					<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
						<div>
							<h3 class="text-xl font-bold">{job.company}</h3>
							<p class="font-medium mt-0.5" style="color: var(--c-muted);">{job.role}</p>
						</div>
						<span class="neo-tag self-start sm:self-auto shrink-0 mt-1">{job.period}</span>
					</div>

					<ul class="space-y-2 mb-6">
						{#each job.highlights as point (point)}
							<li class="flex gap-3 text-sm leading-relaxed" style="color: var(--c-muted);">
								<span style="color: var(--c-accent);" class="font-bold mt-0.5 shrink-0">→</span>
								{point}
							</li>
						{/each}
					</ul>

					<div class="flex flex-wrap gap-2">
						{#each job.tech as t (t)}
							<span
								class="text-xs px-2 py-0.5 font-medium"
								style="border: 1px solid var(--c-border-soft); color: var(--c-muted);"
							>{t}</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- SKILLS -->
<section id="skills" class="py-24 px-6" style="background-color: var(--c-bg-alt);">
	<div class="max-w-6xl mx-auto">
		<p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: var(--c-muted);">
			03 / Skills
		</p>
		<h2 class="text-4xl md:text-5xl font-bold mb-16">What I work with.</h2>

		<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
			{#each skillGroups as group (group.label)}
				<div>
					<h3
						class="text-xs font-bold uppercase tracking-widest mb-4 pb-2"
						style="border-bottom: 2px solid var(--c-ink);"
					>
						{group.label}
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each group.skills as skill (skill)}
							<span class="neo-tag" use:stamp onclick={() => handleSkillStamp(skill)}>{skill}</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- EDUCATION -->
<section id="education" class="py-24 px-6">
	<div class="max-w-6xl mx-auto">
		<p class="text-xs font-bold uppercase tracking-widest mb-3" style="color: var(--c-muted);">
			04 / Education
		</p>
		<h2 class="text-4xl md:text-5xl font-bold mb-16">Academic background.</h2>

		<div class="grid md:grid-cols-2 gap-8 mb-16">
			{#each education as edu (edu.degree)}
				<div class="neo-card p-8">
					<p class="text-sm font-semibold mb-3" style="color: var(--c-muted);">{edu.year}</p>
					<h3 class="text-lg font-bold leading-snug mb-2">{edu.degree}</h3>
					<p class="text-sm" style="color: var(--c-muted);">{edu.institution}</p>
					<p class="text-xs mt-1" style="color: var(--c-muted);">{edu.location}</p>
					{#if edu.note}
						<span class="neo-tag mt-4 inline-block">{edu.note}</span>
					{/if}
				</div>
			{/each}
		</div>

		<p class="text-xs font-bold uppercase tracking-widest mb-6" style="color: var(--c-muted);">
			Certifications & Achievements
		</p>
		<div class="space-y-3">
			{#each certifications as cert (cert.title)}
				<div
					class="flex items-center justify-between gap-4 py-3"
					style="border-bottom: 1px solid var(--c-border-soft);"
				>
					<div class="flex items-center gap-3">
						{#if cert.highlight}
							<span
								class="w-2 h-2 shrink-0 inline-block"
								style="background-color: var(--c-accent); border: 1px solid var(--c-ink);"
							></span>
						{:else}
							<span
								class="w-2 h-2 shrink-0 inline-block"
								style="background-color: var(--c-border-soft); border: 1px solid var(--c-muted); opacity: 0.6;"
							></span>
						{/if}
						<span class="text-sm font-medium">{cert.title}</span>
					</div>
					<span class="text-sm shrink-0" style="color: var(--c-muted);">{cert.year}</span>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- CONTACT -->
<section id="contact" class="contact-section py-24 px-6">
	<div class="max-w-6xl mx-auto">
		<p class="contact-muted text-xs font-bold uppercase tracking-widest mb-3">05 / Contact</p>
		<h2 class="text-4xl md:text-5xl font-bold mb-6 leading-tight">
			Let's build something<br />
			<span class="relative inline-block">
				great together
				<span
					class="absolute -bottom-1 left-0 right-0 h-3 -z-10"
					style="background-color: var(--c-contact-hover);"
				></span>
			</span>
			.
		</h2>

		<p class="contact-muted max-w-md mb-12 text-lg">
			Open to new opportunities. Reach out and let's talk.
		</p>

		<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
			{#each [
				{ label: 'Email', value: 'etienne.de.lange1@gmail.com', href: 'mailto:etienne.de.lange1@gmail.com' },
				{ label: 'Phone', value: '+27 76 920 9230', href: 'tel:+27769209230' },
				{ label: 'Location', value: 'Port Elizabeth, South Africa', href: null }
			] as item (item.label)}
				<div class="contact-card p-6">
					<p class="contact-muted text-xs font-bold uppercase tracking-widest mb-2">{item.label}</p>
					{#if item.href}
						<a href={item.href} class="contact-link font-semibold text-sm break-all">{item.value}</a>
					{:else}
						<p class="font-semibold text-sm">{item.value}</p>
					{/if}
				</div>
			{/each}
		</div>

		<div class="flex flex-wrap gap-4 items-center">
			<a href="mailto:etienne.de.lange1@gmail.com" class="contact-cta px-8 py-4">
				Send an email
			</a>
			<p class="contact-aside text-sm">Available for freelance & full-time roles</p>
		</div>
	</div>
</section>

</main>

<Terminal bind:open={terminalOpen} />
<svelte:window onkeydown={handleKeydown} />

<!-- TIME-OF-DAY DEV SLIDER -->
{#if sliderVisible}
<div
	style="position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
	       background:var(--c-bg);border:2px solid var(--c-ink);
	       padding:0.75rem 1rem;display:flex;flex-direction:column;gap:0.5rem;
	       min-width:220px;box-shadow:3px 3px 0 var(--c-ink);"
>
	<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
		<span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--c-muted);">Time preview</span>
		<span style="font-size:0.75rem;font-weight:700;font-family:monospace;color:var(--c-ink);">{timeLabel}</span>
	</div>
	<input
		type="range" min="0" max="23.99" step="0.25"
		value={testHour ?? new Date().getHours() + new Date().getMinutes() / 60}
		oninput={(e) => { testHour = parseFloat((e.target as HTMLInputElement).value); }}
		style="width:100%;accent-color:var(--c-accent);"
	/>
	<button
		onclick={() => { testHour = null; }}
		style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;
		       color:var(--c-muted);background:none;border:none;cursor:pointer;text-align:left;padding:0;"
	>
		{testHour !== null ? '↩ Reset to real time' : '← drag to override'}
	</button>
	<div style="height:1px;background:var(--c-border-soft);margin:0.25rem 0;"></div>
	<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
		<span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--c-muted);">Grain intensity</span>
		<span style="font-size:0.75rem;font-weight:700;font-family:monospace;color:var(--c-ink);">{grainOpacity.toFixed(2)}</span>
	</div>
	<input
		type="range" min="0" max="1" step="0.01"
		value={grainOpacity}
		oninput={(e) => { grainOpacity = parseFloat((e.target as HTMLInputElement).value); }}
		style="width:100%;accent-color:var(--c-accent);"
	/>
</div>

{/if}

<!-- FOOTER -->
<footer class="py-8 px-6" style="border-top: 2px solid var(--c-ink);">
	<div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
		<p class="text-sm" style="color: var(--c-muted);">
			© {new Date().getFullYear()} Etienne de Lange
		</p>
		<p class="text-xs" style="color: var(--c-muted);">Built with SvelteKit · Tailwind CSS</p>
	</div>
</footer>

<p class="footer-secret" class:is-visible={footerSecretVisible}>
	You made it. Most people don't scroll this far.
</p>

<style>
	/* ── Portrait retro effects ─────────────────────────────── */
	.portrait-frame {
		position: relative;
		display: block;
		border: 2px solid var(--c-ink);
		overflow: hidden;
		isolation: isolate;
		transition: border-color 0.25s ease;
	}

	/* Yellow background behind the image — creates the duotone when
	   the image is set to mix-blend-mode: multiply + grayscale */
	.portrait-duo {
		display: block;
		line-height: 0;
		background-color: var(--c-portrait-tint, var(--c-accent));
	}

	.portrait-duo.transitions-on {
		transition: background-color 0.6s ease;
	}

	.portrait-img {
		display: block;
		width: 100%;
		filter: grayscale(1) contrast(1.3) brightness(1.05);
		mix-blend-mode: multiply;
	}

	/* Animated film grain — oversized so translation never shows edges */
	.portrait-grain {
		position: absolute;
		inset: 0;
		width: 300%;
		height: 300%;
		top: -100%;
		left: -100%;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 200px 200px;
		opacity: 0.09;
		animation: portrait-grain-move 0.14s steps(1) infinite;
		pointer-events: none;
		z-index: 2;
	}

	/* Horizontal scanlines */
	.portrait-lines {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 2px,
			rgba(0, 0, 0, 0.055) 2px,
			rgba(0, 0, 0, 0.055) 3px
		);
		pointer-events: none;
		z-index: 2;
	}

	@keyframes portrait-grain-move {
		0%   { transform: translate(0%,    0%);   }
		10%  { transform: translate(-4%,  -3%);   }
		20%  { transform: translate(-9%,   5%);   }
		30%  { transform: translate( 6%,  -8%);   }
		40%  { transform: translate(-3%,  11%);   }
		50%  { transform: translate(-7%,   2%);   }
		60%  { transform: translate( 13%, -1%);   }
		70%  { transform: translate( 2%,   9%);   }
		80%  { transform: translate(-11%,  0%);   }
		90%  { transform: translate( 7%,   4%);   }
		100% { transform: translate( 3%,  -2%);   }
	}
</style>
