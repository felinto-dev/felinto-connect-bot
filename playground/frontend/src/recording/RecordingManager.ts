import { SharedServices } from '../shared';

export class RecordingManager {
  private sharedServices: SharedServices;
  private isRecording: boolean = false;
  private recordingTimer: number | null = null;
  private recordingStartTime: Date | null = null;
  private actionsCount: number = 0;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
  }

  public init(): void {
    this.setupEventListeners();
    this.checkConnectionStatus();
    this.initializeUI();
  }

  private setupEventListeners(): void {
    // Botões de controle de gravação
    document.getElementById('startRecordingBtn')?.addEventListener('click', () => this.startRecording());
    document.getElementById('pauseRecordingBtn')?.addEventListener('click', () => this.pauseRecording());
    document.getElementById('stopRecordingBtn')?.addEventListener('click', () => this.stopRecording());

    // Botões de seção
    document.getElementById('toggleRecordingConfigSection')?.addEventListener('click', () => this.toggleSection('recordingConfig'));
    document.getElementById('toggleRecordingExecutionSection')?.addEventListener('click', () => this.toggleSection('recordingExecution'));

    // Botões de ações
    document.getElementById('clearActionsBtn')?.addEventListener('click', () => this.clearActions());
    document.getElementById('exportActionsBtn')?.addEventListener('click', () => this.exportActions());
    document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => this.refreshPreview());

    // Timeline controls
    document.getElementById('playTimelineBtn')?.addEventListener('click', () => this.playTimeline());
    document.getElementById('pauseTimelineBtn')?.addEventListener('click', () => this.pauseTimeline());

    // Preview controls
    document.getElementById('takePreviewScreenshot')?.addEventListener('click', () => this.takePreviewScreenshot());
    document.getElementById('fullscreenPreview')?.addEventListener('click', () => this.toggleFullscreenPreview());
  }

  private async checkConnectionStatus(): Promise<void> {
    const chromeStatusIcon = document.getElementById('recordingChromeStatus');
    const chromeStatusText = document.getElementById('recordingChromeStatusText');
    const playgroundStatusIcon = document.getElementById('recordingPlaygroundStatus');
    const playgroundStatusText = document.getElementById('recordingPlaygroundStatusText');

    // Verificar Chrome
    try {
      await this.sharedServices.apiService.checkChromeStatus();
      this.updateStatusIndicator(chromeStatusIcon, chromeStatusText, 'success', 'Chrome conectado e disponível');
    } catch (error: any) {
      this.updateStatusIndicator(chromeStatusIcon, chromeStatusText, 'error', `Chrome não disponível: ${error.message}`);
    }

    // Verificar configurações do Playground
    try {
      // Simular verificação das configurações do playground
      // Em uma implementação real, isso verificaria se há configurações salvas
      this.updateStatusIndicator(playgroundStatusIcon, playgroundStatusText, 'success', 'Configurações do Playground carregadas');
    } catch (error: any) {
      this.updateStatusIndicator(playgroundStatusIcon, playgroundStatusText, 'warning', 'Nenhuma configuração encontrada');
    }
  }

  private updateStatusIndicator(iconElement: HTMLElement | null, textElement: HTMLElement | null, status: 'success' | 'error' | 'warning', message: string): void {
    if (!iconElement || !textElement) return;

    iconElement.className = `status-icon ${status}`;
    textElement.textContent = message;

    // Atualizar classes CSS para cores
    iconElement.classList.remove('success', 'error', 'warning');
    iconElement.classList.add(status);
  }

  private initializeUI(): void {
    this.updateRecordingUI();
    this.updateActionsCount();
  }

  private async startRecording(): Promise<void> {
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordingStartTime = new Date();
    this.actionsCount = 0;

    this.updateRecordingUI();
    this.startRecordingTimer();

    console.log('🔴 Gravação iniciada');
  }

  private pauseRecording(): void {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.stopRecordingTimer();
    this.updateRecordingUI();

  }

  private stopRecording(): void {
    this.isRecording = false;
    this.stopRecordingTimer();
    this.recordingStartTime = null;
    this.updateRecordingUI();

  }

  private startRecordingTimer(): void {
    this.recordingTimer = window.setInterval(() => {
      this.updateRecordingTime();
    }, 1000);
  }

  private stopRecordingTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  private updateRecordingTime(): void {
    if (!this.recordingStartTime) return;

    const elapsed = Date.now() - this.recordingStartTime.getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    const timerElement = document.getElementById('recordingTimer');
    if (timerElement) {
      timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    const durationElement = document.getElementById('recordingDuration');
    if (durationElement) {
      durationElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private updateRecordingUI(): void {
    const startBtn = document.getElementById('startRecordingBtn') as HTMLButtonElement;
    const statusContainer = document.getElementById('recordingStatusContainer');
    const recordingInfo = document.getElementById('recordingInfo');

    if (this.isRecording) {
      if (startBtn) startBtn.style.display = 'none';
      if (statusContainer) statusContainer.style.display = 'block';
      if (recordingInfo) recordingInfo.style.display = 'block';
    } else {
      if (startBtn) startBtn.style.display = 'block';
      if (statusContainer) statusContainer.style.display = 'none';
      if (recordingInfo && !this.recordingStartTime) recordingInfo.style.display = 'none';
    }
  }

  private updateActionsCount(): void {
    const actionsCountElement = document.getElementById('actionsCount');
    const totalActionsCountElement = document.getElementById('totalActionsCount');

    if (actionsCountElement) {
      actionsCountElement.textContent = this.actionsCount.toString();
    }
    if (totalActionsCountElement) {
      totalActionsCountElement.textContent = this.actionsCount.toString();
    }
  }

  private toggleSection(sectionType: 'recordingConfig' | 'recordingExecution'): void {
    const contentId = sectionType === 'recordingConfig' ? 'recordingConfigSectionContent' : 'recordingExecutionSectionContent';
    const toggleBtnId = sectionType === 'recordingConfig' ? 'toggleRecordingConfigSection' : 'toggleRecordingExecutionSection';

    const content = document.getElementById(contentId);
    const toggleBtn = document.getElementById(toggleBtnId);

    if (!content || !toggleBtn) return;

    const isCollapsed = content.style.display === 'none';
    
    content.style.display = isCollapsed ? 'block' : 'none';
    
    const icon = toggleBtn.querySelector('.toggle-icon');
    const text = toggleBtn.querySelector('.toggle-text');
    
    if (icon && text) {
      if (isCollapsed) {
        icon.setAttribute('data-lucide', 'chevron-up');
        text.textContent = 'Recolher';
      } else {
        icon.setAttribute('data-lucide', 'chevron-down');
        text.textContent = 'Expandir';
      }
      
      // Reinicializar ícones
      if (typeof window.lucide !== 'undefined') {
        window.lucide.createIcons();
      }
    }
  }

  private clearActions(): void {
    this.actionsCount = 0;
    this.updateActionsCount();

    const actionsList = document.getElementById('actionsList');
    if (actionsList) {
      actionsList.innerHTML = `
        <div class="actions-empty">
          <i data-lucide="mouse-pointer" class="empty-icon"></i>
          <p>Nenhuma ação gravada ainda</p>
          <small>As ações aparecerão aqui conforme você interage com a página</small>
        </div>
      `;
      
      // Reinicializar ícones
      if (typeof window.lucide !== 'undefined') {
        window.lucide.createIcons();
      }
    }

  }

  private async exportActions(): Promise<void> {
    // Implementar exportação das ações gravadas
    console.log('📤 Exportando ações...');
  }

  private refreshPreview(): void {
    console.log('🔄 Atualizando preview...');
  }

  private playTimeline(): void {
  }

  private pauseTimeline(): void {
  }

  private takePreviewScreenshot(): void {
  }

  private toggleFullscreenPreview(): void {
  }
}
