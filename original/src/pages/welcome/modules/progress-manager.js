export class ProgressManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /** Update progress bar width */
  updateProgressBar() {
    const progressSteps = document.querySelector('.progress-steps');
    const progressFill = document.getElementById('progressFill');
    const currentStepEl = document.getElementById('currentStep');
    const progressPercentageEl = document.getElementById('progressPercentage');

    const percentage =
      ((this.stateManager.currentStep - 1) / (this.stateManager.totalSteps - 1)) * 100;

    if (progressSteps) {
      progressSteps.style.setProperty('--progress-width', `${percentage}%`);
    }

    if (progressFill) {
      progressFill.style.setProperty('--fill-width', `${percentage}%`);
      progressFill.setAttribute('aria-valuenow', Math.round(percentage));
    }

    if (currentStepEl) {
      currentStepEl.textContent = this.stateManager.currentStep;
    }

    if (progressPercentageEl) {
      progressPercentageEl.textContent = `${Math.round(percentage)}%`;
    }
  }

  /** Update step indicators */
  updateSteps() {
    document.querySelectorAll('.step').forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');

      if (stepNum === this.stateManager.currentStep) {
        step.classList.add('active');
      } else if (stepNum < this.stateManager.currentStep) {
        step.classList.add('completed');
      }
    });
  }

  /** Update content sections visibility */
  updateContentSections() {
    document.querySelectorAll('.section').forEach((section, index) => {
      section.classList.toggle('active', index + 1 === this.stateManager.currentStep);
    });
  }

  /** Update all UI elements */
  updateUI() {
    this.updateSteps();
    this.updateProgressBar();
    this.updateContentSections();

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
