const READER_MODE_KEY = 'manga_reader_mode';
const READER_OFFSET_KEY = 'manga_reader_offset';

const Reader = {
  pages: [],
  currentIndex: 0,
  mode: localStorage.getItem(READER_MODE_KEY) || 'single',
  offset: localStorage.getItem(READER_OFFSET_KEY) === 'true',
  series: null,
  chapters: [],
  currentChapterIndex: 0,
  controlsTimeout: null,
  imageDimensions: {}, // Cache image natural aspect ratios

  init() {
    const select = document.getElementById('reader-mode-select');
    select.value = this.mode;

    const offsetToggle = document.getElementById('reader-offset-toggle');
    offsetToggle.checked = this.offset;
    this.updateOffsetVisibility();

    select.addEventListener('change', (e) => {
      this.mode = e.target.value;
      localStorage.setItem(READER_MODE_KEY, this.mode);
      this.updateOffsetVisibility();
      this.render();
    });

    offsetToggle.addEventListener('change', (e) => {
      this.offset = e.target.checked;
      localStorage.setItem(READER_OFFSET_KEY, this.offset);
      this.render();
    });

    document.getElementById('btn-floating-back').addEventListener('click', () => this.close());
    
    const settingsBtn = document.getElementById('btn-floating-settings');
    const settingsPanel = document.getElementById('reader-settings-panel');
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPanel.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });

    settingsPanel.addEventListener('click', (e) => e.stopPropagation());

    const overlay = document.getElementById('reader-overlay');
    overlay.addEventListener('mousemove', () => this.showControlsTemporarily());
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
      if (this.mode === 'scroll') return;

      const rect = overlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      
      // RTL Navigation: Tapping left side goes forward (higher page index), tapping right goes back
      if (clickX < rect.width * 0.35) {
        this.next(); 
      } else if (clickX > rect.width * 0.65) {
        this.prev(); 
      } else {
        settingsPanel.classList.toggle('hidden');
      }
    });

    window.addEventListener('keydown', (e) => {
      if (document.getElementById('reader-overlay').classList.contains('hidden')) return;
      if (e.key === 'ArrowRight') this.prev();
      if (e.key === 'ArrowLeft') this.next();
      if (e.key === 'Escape') this.close();
    });

    document.getElementById('btn-next-chapter-confirm').addEventListener('click', () => {
      document.getElementById('chapter-transition-modal').classList.add('hidden');
      this.loadNextChapter();
    });

    document.getElementById('btn-transition-close').addEventListener('click', () => {
      this.close();
    });
  },

  updateOffsetVisibility() {
    const row = document.getElementById('offset-option-row');
    if (this.mode === 'double') {
      row.classList.remove('hidden');
    } else {
      row.classList.add('hidden');
    }
  },

  showControlsTemporarily() {
    const overlay = document.getElementById('reader-overlay');
    overlay.classList.remove('controls-hidden');
    clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (document.getElementById('reader-settings-panel').classList.contains('hidden')) {
        overlay.classList.add('controls-hidden');
      }
    }, 3000);
  },

  async open(series, chapters, chapterIndex) {
    this.series = series;
    this.chapters = chapters;
    this.currentChapterIndex = chapterIndex;
    this.imageDimensions = {};
    
    await this.fetchAndRenderCurrentChapter();
    document.getElementById('reader-overlay').classList.remove('hidden');
    this.showControlsTemporarily();
  },

  async fetchAndRenderCurrentChapter() {
    const ch = this.chapters[this.currentChapterIndex];
    const data = await API.getPages(this.series.source, this.series.id, ch.id);
    this.pages = data.pages;
    this.currentIndex = 0;
    document.getElementById('chapter-transition-modal').classList.add('hidden');
    
    // Preload image dimensions to check for wide spreads correctly
    await this.preloadImageDimensions();
    this.render();
  },

  preloadImageDimensions() {
    return Promise.all(
      this.pages.map((url) => {
        if (this.imageDimensions[url] !== undefined) return Promise.resolve();
        return new Promise((resolve) => {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            this.imageDimensions[url] = {
              width: img.naturalWidth,
              height: img.naturalHeight,
              isWide: img.naturalWidth > img.naturalHeight,
            };
            resolve();
          };
          img.onerror = () => {
            this.imageDimensions[url] = { width: 100, height: 100, isWide: false };
            resolve();
          };
        });
      })
    );
  },

  close() {
    document.getElementById('reader-overlay').classList.add('hidden');
    document.getElementById('reader-stage').innerHTML = '';
    document.getElementById('chapter-transition-modal').classList.add('hidden');
  },

  isWidePage(index) {
    if (index < 0 || index >= this.pages.length) return false;
    const url = this.pages[index];
    return this.imageDimensions[url]?.isWide === true;
  },

  prev() {
    if (this.mode === 'scroll') return;
    if (this.currentIndex > 0) {
      // Find previous step in double mode
      if (this.mode === 'double') {
        this.currentIndex = Math.max(0, this.currentIndex - this.getBackwardStep());
      } else {
        this.currentIndex--;
      }
      this.render();
    }
  },

  next() {
    if (this.mode === 'scroll') return;
    const step = this.getForwardStep();
    if (this.currentIndex + step < this.pages.length) {
      this.currentIndex += step;
      this.render();
    } else {
      this.handleChapterEnd();
    }
  },

  getForwardStep() {
    if (this.mode !== 'double') return 1;
    const isFirstOffset = this.offset && this.currentIndex === 0;
    if (isFirstOffset) return 1;

    // If current page is wide, it stands alone [6] -> step is 1
    if (this.isWidePage(this.currentIndex)) return 1;

    // If next page exists and current is normal, check if next is wide or normal pair
    const nextIdx = this.currentIndex + 1;
    if (this.isWidePage(nextIdx)) return 1; // current stands alone if next is wide

    // Normal pair [5 | 4] -> consumes 2 pages
    return 2;
  },

  getBackwardStep() {
    if (this.mode !== 'double') return 1;
    const targetIdx = this.currentIndex - 1;
    if (targetIdx <= 0) return 1;

    if (this.offset && targetIdx === 1) return 1;
    if (this.isWidePage(targetIdx)) return 1;
    if (this.isWidePage(targetIdx - 1)) return 1;

    return 2;
  },

  handleChapterEnd() {
    if (this.currentChapterIndex + 1 < this.chapters.length) {
      document.getElementById('transition-msg').textContent = `Finished ${this.chapters[this.currentChapterIndex].title}. Proceed to next chapter?`;
      document.getElementById('chapter-transition-modal').classList.remove('hidden');
    } else {
      alert("You've reached the latest available chapter!");
    }
  },

  async loadNextChapter() {
    if (this.currentChapterIndex + 1 < this.chapters.length) {
      this.currentChapterIndex++;
      await this.fetchAndRenderCurrentChapter();
    }
  },

  render() {
    const stage = document.getElementById('reader-stage');
    stage.className = `reader-stage mode-${this.mode}`;
    stage.innerHTML = '';

    if (!this.pages.length) return;

    if (this.mode === 'scroll') {
      for (let i = 0; i < this.pages.length; i++) {
        const img = document.createElement('img');
        img.src = this.pages[i];
        img.loading = 'lazy';
        stage.appendChild(img);
      }
      
      if (this.currentChapterIndex + 1 < this.chapters.length) {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'scroll-chapter-footer';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary';
        nextBtn.textContent = 'Load Next Chapter →';
        nextBtn.addEventListener('click', () => {
          this.currentChapterIndex++;
          this.fetchAndRenderCurrentChapter();
          stage.scrollTop = 0;
        });
        footerDiv.appendChild(nextBtn);
        stage.appendChild(footerDiv);
      }
      return;
    }

    if (this.mode === 'single') {
      const img = document.createElement('img');
      img.src = this.pages[this.currentIndex];
      stage.appendChild(img);
    } else if (this.mode === 'double') {
      const isSoloOffset = this.offset && this.currentIndex === 0;
      const isCurrentWide = this.isWidePage(this.currentIndex);

      if (isSoloOffset || isCurrentWide) {
        // Display single image by itself [6]
        const img = document.createElement('img');
        img.src = this.pages[this.currentIndex];
        if (isCurrentWide) img.classList.add('wide-spread');
        stage.appendChild(img);
      } else {
        // Right-to-Left Pair: [Higher Page (Left) | Lower Page (Right)] e.g., [5 | 4]
        const rightPageUrl = this.pages[this.currentIndex]; // Page 4 (Right)
        const nextIdx = this.currentIndex + 1;
        const hasNext = nextIdx < this.pages.length;
        const isNextWide = hasNext && this.isWidePage(nextIdx);

        if (!hasNext || isNextWide) {
          // Only enough room for one normal page here
          const img = document.createElement('img');
          img.src = rightPageUrl;
          stage.appendChild(img);
        } else {
          const leftPageUrl = this.pages[nextIdx]; // Page 5 (Left)

          const imgLeft = document.createElement('img');
          imgLeft.src = leftPageUrl;

          const imgRight = document.createElement('img');
          imgRight.src = rightPageUrl;

          // Append in DOM order such that CSS flex-direction: row-reverse places
          // imgLeft on the Left and imgRight on the Right -> [5 | 4]
          stage.appendChild(imgLeft);
          stage.appendChild(imgRight);
        }
      }
    }
  },
};