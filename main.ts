import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import panzoom from 'panzoom';

interface BetterMermaidSettings {
	zoomFactor: number;
	minZoom: number;
	maxZoom: number;
	enableOverlay: boolean;
}

const DEFAULT_SETTINGS: BetterMermaidSettings = {
	zoomFactor: 0.2, // zoom speed
	minZoom: 0.5,    // minimum zoom level
	maxZoom: 10,     // maximum zoom level
	enableOverlay: true
}

export default class BetterMermaidPlugin extends Plugin {
	settings: BetterMermaidSettings;
	private activeOverlay: HTMLElement | null = null;
	private activeInstance: any | null = null;

	async onload() {
		await this.loadSettings();

		// Register for updates whenever the view changes
		this.registerEvent(
			this.app.workspace.on('layout-change', this.handleLayoutChange.bind(this))
		);

		// Register for updates whenever a file is opened
		this.registerEvent(
			this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
		);

		// Add settings tab
		this.addSettingTab(new BetterMermaidSettingTab(this.app, this));
		
		// Initial render
		this.enhanceMermaidDiagrams();
	}

	/**
	 * Called when layout changes
	 */
	private handleLayoutChange(): void {
		this.enhanceMermaidDiagrams();
	}

	/**
	 * Called when a file is opened
	 */
	private handleFileOpen(): void {
		// Small delay to make sure diagrams are rendered
		setTimeout(() => {
			this.enhanceMermaidDiagrams();
		}, 300);
	}

	/**
	 * Find all Mermaid diagrams in the current view and enhance them
	 */
	private enhanceMermaidDiagrams(): void {
		// Find all rendered mermaid diagrams
		const mermaidDiagrams = document.querySelectorAll('.mermaid');
		
		mermaidDiagrams.forEach((diagramEl) => {
			// Skip if already enhanced
			if (diagramEl.hasAttribute('data-better-mermaid-enhanced')) {
				return;
			}

			// Mark as enhanced
			diagramEl.setAttribute('data-better-mermaid-enhanced', 'true');

			// Add click event to diagram
			diagramEl.addEventListener('click', (e) => {
				if (this.settings.enableOverlay) {
					this.createOverlay(diagramEl as HTMLElement);
				}
			});
		});
	}

	/**
	 * Create an overlay with the diagram for zooming and panning
	 */
	private createOverlay(diagramEl: HTMLElement): void {
		// Remove any existing overlay
		this.removeOverlay();

		// Create an overlay div
		const overlay = document.createElement('div');
		overlay.addClass('better-mermaid-overlay');
		
		// Clone the diagram to the overlay
		const diagramClone = diagramEl.cloneNode(true) as HTMLElement;
		diagramClone.addClass('better-mermaid-diagram');
		overlay.appendChild(diagramClone);

		// Add close button
		const closeButton = document.createElement('div');
		closeButton.addClass('better-mermaid-close-button');
		closeButton.innerHTML = '×'; // × character
		closeButton.addEventListener('click', (e) => {
			e.stopPropagation();
			this.removeOverlay();
		});
		overlay.appendChild(closeButton);

		// Add to document body
		document.body.appendChild(overlay);
		this.activeOverlay = overlay;

		// Initialize panzoom
		this.activeInstance = panzoom(diagramClone, {
			smoothScroll: false,
			zoomDoubleClickSpeed: 1,
			minZoom: this.settings.minZoom,
			maxZoom: this.settings.maxZoom,
			zoomSpeed: this.settings.zoomFactor
		});

		// Prevent default scroll behavior inside overlay
		overlay.addEventListener('wheel', (e) => {
			e.preventDefault();
		});

		// Close on ESC key
		document.addEventListener('keydown', this.escKeyHandler);
	}

	private escKeyHandler = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && this.activeOverlay) {
			this.removeOverlay();
		}
	};

	/**
	 * Remove the active overlay
	 */
	private removeOverlay(): void {
		if (this.activeOverlay) {
			// Remove ESC key handler
			document.removeEventListener('keydown', this.escKeyHandler);

			// Destroy panzoom instance
			if (this.activeInstance) {
				this.activeInstance.dispose();
				this.activeInstance = null;
			}

			// Remove overlay
			document.body.removeChild(this.activeOverlay);
			this.activeOverlay = null;
		}
	}

	onunload() {
		// Remove any active overlay
		this.removeOverlay();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class BetterMermaidSettingTab extends PluginSettingTab {
	plugin: BetterMermaidPlugin;

	constructor(app: App, plugin: BetterMermaidPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Better Mermaid Settings'});

		new Setting(containerEl)
			.setName('Zoom Speed')
			.setDesc('How fast to zoom in and out (0.1 - slow, 1.0 - fast)')
			.addSlider(slider => slider
				.setLimits(0.1, 1.0, 0.1)
				.setValue(this.plugin.settings.zoomFactor)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.zoomFactor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Minimum Zoom')
			.setDesc('Minimum zoom level (0.1 - 1.0)')
			.addSlider(slider => slider
				.setLimits(0.1, 1.0, 0.1)
				.setValue(this.plugin.settings.minZoom)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.minZoom = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum Zoom')
			.setDesc('Maximum zoom level (1.0 - 20.0)')
			.addSlider(slider => slider
				.setLimits(1.0, 20.0, 0.5)
				.setValue(this.plugin.settings.maxZoom)
				.setDynamicTooltip()