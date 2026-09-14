// CODE BY AKSHIT SUTHAR

document.addEventListener("DOMContentLoaded", function () {
  let markdownRenderTimeout = null;
  const RENDER_DELAY = 100;
  let syncScrollingEnabled = true;
  let isEditorScrolling = false;
  let isPreviewScrolling = false;
  let scrollSyncTimeout = null;
  const SCROLL_SYNC_DELAY = 10;

  // View Mode State - Story 1.1
  let currentViewMode = 'split'; // 'editor', 'split', or 'preview'

  const markdownEditor = document.getElementById("markdown-editor");
  const markdownPreview = document.getElementById("markdown-preview");
  const themeToggle = document.getElementById("theme-toggle");
  const importButton = document.getElementById("import-button");
  const fileInput = document.getElementById("file-input");
  const exportMd = document.getElementById("export-md");
  const exportHtml = document.getElementById("export-html");
  const exportPdf = document.getElementById("export-pdf");
  const copyMarkdownButton = document.getElementById("copy-markdown-button");
  const dropzone = document.getElementById("dropzone");
  const closeDropzoneBtn = document.getElementById("close-dropzone");
  const toggleSyncButton = document.getElementById("toggle-sync");
  const editorPane = document.getElementById("markdown-editor");
  const previewPane = document.querySelector(".preview-pane");
  const readingTimeElement = document.getElementById("reading-time");
  const wordCountElement = document.getElementById("word-count");
  const charCountElement = document.getElementById("char-count");

  // View Mode Elements - Story 1.1
  const contentContainer = document.querySelector(".content-container");
  const viewModeButtons = document.querySelectorAll(".view-mode-btn");

  // Mobile View Mode Elements - Story 1.4
  const mobileViewModeButtons = document.querySelectorAll(".mobile-view-mode-btn");

  // Resize Divider Elements - Story 1.3
  const resizeDivider = document.querySelector(".resize-divider");
  const editorPaneElement = document.querySelector(".editor-pane");
  const previewPaneElement = document.querySelector(".preview-pane");
  let isResizing = false;
  let editorWidthPercent = 50; // Default 50%
  const MIN_PANE_PERCENT = 20; // Minimum 20% width

  const mobileMenuToggle    = document.getElementById("mobile-menu-toggle");
  const mobileMenuPanel     = document.getElementById("mobile-menu-panel");
  const mobileMenuOverlay   = document.getElementById("mobile-menu-overlay");
  const mobileCloseMenu     = document.getElementById("close-mobile-menu");
  const mobileReadingTime   = document.getElementById("mobile-reading-time");
  const mobileWordCount     = document.getElementById("mobile-word-count");
  const mobileCharCount     = document.getElementById("mobile-char-count");
  const mobileToggleSync    = document.getElementById("mobile-toggle-sync");
  const mobileImportBtn     = document.getElementById("mobile-import-button");
  const mobileExportMd      = document.getElementById("mobile-export-md");
  const mobileExportHtml    = document.getElementById("mobile-export-html");
  const mobileExportPdf     = document.getElementById("mobile-export-pdf");
  const mobileCopyMarkdown  = document.getElementById("mobile-copy-markdown");
  const mobileThemeToggle   = document.getElementById("mobile-theme-toggle");

  // Host mode elements (server.py API)
  const hostOpenButton        = document.getElementById("host-open-button");
  const hostSaveButton        = document.getElementById("host-save-button");
  const mobileHostOpenBtn     = document.getElementById("mobile-host-open-button");
  const mobileHostSaveBtn     = document.getElementById("mobile-host-save-button");
  const hostFileLabel         = document.getElementById("host-file-label");
  const hostDiskChanged       = document.getElementById("host-disk-changed");
  const hostFilesModalElement = document.getElementById("host-files-modal");
  const hostRootName          = document.getElementById("host-root-name");
  const hostFileSearch        = document.getElementById("host-file-search");
  const hostFileList          = document.getElementById("host-file-list");
  const hostConflictLoad      = document.getElementById("host-conflict-load");
  const hostConflictOverwrite = document.getElementById("host-conflict-overwrite");
  const hostFilesModal = new bootstrap.Modal(hostFilesModalElement);
  const hostConflictModalElement = document.getElementById("host-conflict-modal");
  const hostConflictModal = new bootstrap.Modal(hostConflictModalElement);
  let hostMode = false;
  let hostFile = null; // { path, hash, mtime, eol, savedContent, disk } of the open host file; disk is null | { hash, content } | "deleted"
  let hostFiles = [];
  let hostConflict = null; // { hash, content } from the last 409

  // Check dark mode preference first for proper initialization
  const prefersDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  document.documentElement.setAttribute(
    "data-theme",
    prefersDarkMode ? "dark" : "light"
  );
  
  themeToggle.innerHTML = prefersDarkMode
    ? '<i class="bi bi-sun"></i>'
    : '<i class="bi bi-moon"></i>';

  const initMermaid = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const mermaidTheme = currentTheme === "dark" ? "dark" : "default";
    
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      fontSize: 16
    });
  };

  try {
    initMermaid();
  } catch (e) {
    console.warn("Mermaid initialization failed:", e);
  }

  const markedOptions = {
    gfm: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartypants: false,
    xhtml: false,
    headerIds: true,
    mangle: false,
  };

  const renderer = new marked.Renderer();
  renderer.code = function (code, language) {
    if (language === 'mermaid') {
      const uniqueId = 'mermaid-diagram-' + Math.random().toString(36).substr(2, 9);
      return `<div class="mermaid-container"><div class="mermaid" id="${uniqueId}">${code}</div></div>`;
    }
    
    const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
    const highlightedCode = hljs.highlight(code, {
      language: validLanguage,
    }).value;
    return `<pre><code class="hljs ${validLanguage}">${highlightedCode}</code></pre>`;
  };

  marked.setOptions({
    ...markedOptions,
    renderer: renderer,
    highlight: function (code, language) {
      if (language === 'mermaid') return code;
      const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
      return hljs.highlight(code, { language: validLanguage }).value;
    },
  });

  const sampleMarkdown = `# Markdown Viewer - Getting Started

## 🚀 Quick Start Guide
- **Instant Preview** with real-time rendering
- **Multiple Export Formats** (Markdown, HTML, PDF)
- **Diagram Support** using Mermaid
- **Mathematical Equations** with LaTeX
- **Emoji Integration** 🎉 ✨ 🔥

## 📝 JavaScript Example
\`\`\`javascript
const greeting = (name) => {
  console.log(\`Hello, \${name}!\`);
  return true;
};

greeting("World");
\`\`\`

## 🔢 Math Equations
Pythagorean theorem: $$a^2 + b^2 = c^2$$

Integration formula:
$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

## 📈 Workflow Diagram
\`\`\`mermaid
graph TD
    A[Write Markdown] --> B[Live Preview]
    B --> C{Satisfied?}
    C -->|Yes| D[Export]
    C -->|No| A
\`\`\`

## ✅ Checklist
- [x] Setup editor interface
- [x] Enable live preview
- [x] Add export functionality
- [ ] Mobile optimization

## 📊 Comparison Table

| Feature | Status | Priority |
|---------|--------|----------|
| Preview | ✅ Ready | High |
| Export | ✅ Ready | High |
| Sync | ✅ Ready | Medium |

---

**Created with ❤️ for markdown enthusiasts**`;

  // A URL naming a host file gets first chance at the editor — don't flash the sample
  // doc first, only to immediately replace it once the host file loads.
  const pendingHostPath = new URLSearchParams(location.search).get("path");

  if (!pendingHostPath) {
    markdownEditor.value = sampleMarkdown;
  }

  function renderMarkdown() {
    try {
      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container'],
        ADD_ATTR: ['id', 'class', 'style']
      });
      markdownPreview.innerHTML = sanitizedHtml;

      markdownPreview.querySelectorAll("pre code").forEach((block) => {
        try {
          if (!block.classList.contains('mermaid')) {
            hljs.highlightElement(block);
          }
        } catch (e) {
          console.warn("Syntax highlighting failed for a code block:", e);
        }
      });

      processEmojis(markdownPreview);
      
      // Reinitialize mermaid with current theme before rendering diagrams
      initMermaid();
      
      try {
        mermaid.init(undefined, markdownPreview.querySelectorAll('.mermaid'));
      } catch (e) {
        console.warn("Mermaid rendering failed:", e);
      }
      
      if (window.MathJax) {
        try {
          MathJax.typesetPromise([markdownPreview]).catch((err) => {
            console.warn('MathJax typesetting failed:', err);
          });
        } catch (e) {
          console.warn("MathJax rendering failed:", e);
        }
      }

      updateDocumentStats();
    } catch (e) {
      console.error("Markdown rendering failed:", e);
      markdownPreview.innerHTML = `<div class="alert alert-danger">
              <strong>Error rendering markdown:</strong> ${e.message}
          </div>
          <pre>${markdownEditor.value}</pre>`;
    }
  }

  function importMarkdownFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      markdownEditor.value = e.target.result;
      renderMarkdown();
      dropzone.style.display = "none";
      // A browser-local file must never be saved over the previous host file
      hostFile = null;
      setUrlPath(null);
      updateHostUi();
    };
    reader.readAsText(file);
  }

  function processEmojis(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      let parent = node.parentNode;
      let isInCode = false;
      while (parent && parent !== element) {
        if (parent.tagName === 'PRE' || parent.tagName === 'CODE') {
          isInCode = true;
          break;
        }
        parent = parent.parentNode;
      }
      
      if (!isInCode && node.nodeValue.includes(':')) {
        textNodes.push(node);
      }
    }
    
    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      const emojiRegex = /:([\w+-]+):/g;
      
      let match;
      let lastIndex = 0;
      let result = '';
      let hasEmoji = false;
      
      while ((match = emojiRegex.exec(text)) !== null) {
        const shortcode = match[1];
        const emoji = joypixels.shortnameToUnicode(`:${shortcode}:`);
        
        if (emoji !== `:${shortcode}:`) { // If conversion was successful
          hasEmoji = true;
          result += text.substring(lastIndex, match.index) + emoji;
          lastIndex = emojiRegex.lastIndex;
        } else {
          result += text.substring(lastIndex, emojiRegex.lastIndex);
          lastIndex = emojiRegex.lastIndex;
        }
      }
      
      if (hasEmoji) {
        result += text.substring(lastIndex);
        const span = document.createElement('span');
        span.innerHTML = result;
        textNode.parentNode.replaceChild(span, textNode);
      }
    });
  }

  function debouncedRender() {
    clearTimeout(markdownRenderTimeout);
    markdownRenderTimeout = setTimeout(renderMarkdown, RENDER_DELAY);
  }

  function updateDocumentStats() {
    const text = markdownEditor.value;

    const charCount = text.length;
    charCountElement.textContent = charCount.toLocaleString();

    const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    wordCountElement.textContent = wordCount.toLocaleString();

    const readingTimeMinutes = Math.ceil(wordCount / 200);
    readingTimeElement.textContent = readingTimeMinutes;
  }

  function syncEditorToPreview() {
    if (!syncScrollingEnabled || isPreviewScrolling) return;

    isEditorScrolling = true;
    clearTimeout(scrollSyncTimeout);

    scrollSyncTimeout = setTimeout(() => {
      const editorScrollRatio =
        editorPane.scrollTop /
        (editorPane.scrollHeight - editorPane.clientHeight);
      const previewScrollPosition =
        (previewPane.scrollHeight - previewPane.clientHeight) *
        editorScrollRatio;

      if (!isNaN(previewScrollPosition) && isFinite(previewScrollPosition)) {
        previewPane.scrollTop = previewScrollPosition;
      }

      setTimeout(() => {
        isEditorScrolling = false;
      }, 50);
    }, SCROLL_SYNC_DELAY);
  }

  function syncPreviewToEditor() {
    if (!syncScrollingEnabled || isEditorScrolling) return;

    isPreviewScrolling = true;
    clearTimeout(scrollSyncTimeout);

    scrollSyncTimeout = setTimeout(() => {
      const previewScrollRatio =
        previewPane.scrollTop /
        (previewPane.scrollHeight - previewPane.clientHeight);
      const editorScrollPosition =
        (editorPane.scrollHeight - editorPane.clientHeight) *
        previewScrollRatio;

      if (!isNaN(editorScrollPosition) && isFinite(editorScrollPosition)) {
        editorPane.scrollTop = editorScrollPosition;
      }

      setTimeout(() => {
        isPreviewScrolling = false;
      }, 50);
    }, SCROLL_SYNC_DELAY);
  }

  function toggleSyncScrolling() {
    syncScrollingEnabled = !syncScrollingEnabled;
    if (syncScrollingEnabled) {
      toggleSyncButton.innerHTML = '<i class="bi bi-link-45deg"></i> Sync Off';
      toggleSyncButton.classList.add("sync-disabled");
      toggleSyncButton.classList.remove("sync-enabled");
      toggleSyncButton.classList.add("border-primary");
    } else {
      toggleSyncButton.innerHTML = '<i class="bi bi-link"></i> Sync On';
      toggleSyncButton.classList.add("sync-enabled");
      toggleSyncButton.classList.remove("sync-disabled");
      toggleSyncButton.classList.remove("border-primary");
    }
  }

  // View Mode Functions - Story 1.1 & 1.2
  function setViewMode(mode) {
    if (mode === currentViewMode) return;

    const previousMode = currentViewMode;
    currentViewMode = mode;

    // Update content container class
    contentContainer.classList.remove('view-editor-only', 'view-preview-only', 'view-split');
    contentContainer.classList.add('view-' + (mode === 'editor' ? 'editor-only' : mode === 'preview' ? 'preview-only' : 'split'));

    // Update button active states (desktop)
    viewModeButtons.forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      if (btnMode === mode) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Story 1.4: Update mobile button active states
    mobileViewModeButtons.forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      if (btnMode === mode) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Story 1.2: Show/hide sync toggle based on view mode
    updateSyncToggleVisibility(mode);

    // Story 1.3: Handle pane widths when switching modes
    if (mode === 'split') {
      // Restore preserved pane widths when entering split mode
      applyPaneWidths();
    } else if (previousMode === 'split') {
      // Reset pane widths when leaving split mode
      resetPaneWidths();
    }

    // Re-render markdown when switching to a view that includes preview
    if (mode === 'split' || mode === 'preview') {
      renderMarkdown();
    }
  }

  // Story 1.2: Update sync toggle visibility
  function updateSyncToggleVisibility(mode) {
    const isSplitView = mode === 'split';

    // Desktop sync toggle
    if (toggleSyncButton) {
      toggleSyncButton.style.display = isSplitView ? '' : 'none';
      toggleSyncButton.setAttribute('aria-hidden', !isSplitView);
    }

    // Mobile sync toggle
    if (mobileToggleSync) {
      mobileToggleSync.style.display = isSplitView ? '' : 'none';
      mobileToggleSync.setAttribute('aria-hidden', !isSplitView);
    }
  }

  // Story 1.3: Resize Divider Functions
  function initResizer() {
    if (!resizeDivider) return;

    resizeDivider.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);

    // Touch support for tablets (though disabled via CSS, keeping for future)
    resizeDivider.addEventListener('touchstart', startResizeTouch);
    document.addEventListener('touchmove', handleResizeTouch);
    document.addEventListener('touchend', stopResize);
  }

  function startResize(e) {
    if (currentViewMode !== 'split') return;
    e.preventDefault();
    isResizing = true;
    resizeDivider.classList.add('dragging');
    document.body.classList.add('resizing');
  }

  function startResizeTouch(e) {
    if (currentViewMode !== 'split') return;
    e.preventDefault();
    isResizing = true;
    resizeDivider.classList.add('dragging');
    document.body.classList.add('resizing');
  }

  function handleResize(e) {
    if (!isResizing) return;

    const containerRect = contentContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate percentage
    let newEditorPercent = (mouseX / containerWidth) * 100;

    // Enforce minimum pane widths
    newEditorPercent = Math.max(MIN_PANE_PERCENT, Math.min(100 - MIN_PANE_PERCENT, newEditorPercent));

    editorWidthPercent = newEditorPercent;
    applyPaneWidths();
  }

  function handleResizeTouch(e) {
    if (!isResizing || !e.touches[0]) return;

    const containerRect = contentContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const touchX = e.touches[0].clientX - containerRect.left;

    let newEditorPercent = (touchX / containerWidth) * 100;
    newEditorPercent = Math.max(MIN_PANE_PERCENT, Math.min(100 - MIN_PANE_PERCENT, newEditorPercent));

    editorWidthPercent = newEditorPercent;
    applyPaneWidths();
  }

  function stopResize() {
    if (!isResizing) return;
    isResizing = false;
    resizeDivider.classList.remove('dragging');
    document.body.classList.remove('resizing');
  }

  function applyPaneWidths() {
    if (currentViewMode !== 'split') return;

    const previewPercent = 100 - editorWidthPercent;
    editorPaneElement.style.flex = `0 0 calc(${editorWidthPercent}% - 4px)`;
    previewPaneElement.style.flex = `0 0 calc(${previewPercent}% - 4px)`;
  }

  function resetPaneWidths() {
    editorPaneElement.style.flex = '';
    previewPaneElement.style.flex = '';
  }

  function openMobileMenu() {
    mobileMenuPanel.classList.add("active");
    mobileMenuOverlay.classList.add("active");
  }
  function closeMobileMenu() {
    mobileMenuPanel.classList.remove("active");
    mobileMenuOverlay.classList.remove("active");
  }
  mobileMenuToggle.addEventListener("click", openMobileMenu);
  mobileCloseMenu.addEventListener("click", closeMobileMenu);
  mobileMenuOverlay.addEventListener("click", closeMobileMenu);

  function updateMobileStats() {
    mobileCharCount.textContent   = charCountElement.textContent;
    mobileWordCount.textContent   = wordCountElement.textContent;
    mobileReadingTime.textContent = readingTimeElement.textContent;
  }

  const origUpdateStats = updateDocumentStats;
  updateDocumentStats = function() {
    origUpdateStats();
    updateMobileStats();
  };

  mobileToggleSync.addEventListener("click", () => {
    toggleSyncScrolling();
    if (syncScrollingEnabled) {
      mobileToggleSync.innerHTML = '<i class="bi bi-link-45deg me-2"></i> Sync Off';
      mobileToggleSync.classList.add("sync-disabled");
      mobileToggleSync.classList.remove("sync-enabled");
      mobileToggleSync.classList.add("border-primary");
    } else {
      mobileToggleSync.innerHTML = '<i class="bi bi-link me-2"></i> Sync On';
      mobileToggleSync.classList.add("sync-enabled");
      mobileToggleSync.classList.remove("sync-disabled");
      mobileToggleSync.classList.remove("border-primary");
    }
  });
  mobileImportBtn.addEventListener("click", () => fileInput.click());
  mobileHostOpenBtn.addEventListener("click", () => {
    closeMobileMenu();
    hostOpenButton.click();
  });
  mobileHostSaveBtn.addEventListener("click", () => hostSaveButton.click());
  mobileExportMd.addEventListener("click", () => exportMd.click());
  mobileExportHtml.addEventListener("click", () => exportHtml.click());
  mobileExportPdf.addEventListener("click", () => exportPdf.click());
  mobileCopyMarkdown.addEventListener("click", () => copyMarkdownButton.click());
  mobileThemeToggle.addEventListener("click", () => {
    themeToggle.click();
    mobileThemeToggle.innerHTML = themeToggle.innerHTML + " Toggle Dark Mode";
  });
  
  renderMarkdown();
  updateMobileStats();

  // Initialize view mode - Story 1.1
  contentContainer.classList.add('view-split');

  // Initialize resizer - Story 1.3
  initResizer();

  // View Mode Button Event Listeners - Story 1.1
  viewModeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      setViewMode(mode);
    });
  });

  // Story 1.4: Mobile View Mode Button Event Listeners
  mobileViewModeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      setViewMode(mode);
      closeMobileMenu();
    });
  });

  markdownEditor.addEventListener("input", debouncedRender);
  markdownEditor.addEventListener("input", updateHostUi);
  
  // Tab key handler to insert indentation instead of moving focus
  markdownEditor.addEventListener("keydown", function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const start = this.selectionStart;
      const end = this.selectionEnd;
      const value = this.value;
      
      // Insert 2 spaces
      const indent = '  '; // 2 spaces
      
      // Update textarea value
      this.value = value.substring(0, start) + indent + value.substring(end);
      
      // Update cursor position
      this.selectionStart = this.selectionEnd = start + indent.length;
      
      // Trigger input event to update preview
      this.dispatchEvent(new Event('input'));
    }
  });
  
  editorPane.addEventListener("scroll", syncEditorToPreview);
  previewPane.addEventListener("scroll", syncPreviewToEditor);
  toggleSyncButton.addEventListener("click", toggleSyncScrolling);
  themeToggle.addEventListener("click", function () {
    const theme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", theme);

    if (theme === "dark") {
      themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
    } else {
      themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
    }
    
    renderMarkdown();
  });

  importButton.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      importMarkdownFile(file);
    }
    this.value = "";
  });

  // ========================================
  // HOST MODE - open/save files via server.py
  // ========================================

  // The API only exists when served by server.py; static hosting 404s here
  fetch("api/files")
    .then((res) => (res.ok ? res.json() : null))
    .then(async (data) => {
      if (data && Array.isArray(data.files)) {
        hostMode = true;
        updateHostUi();
        if (pendingHostPath) await openHostFile(pendingHostPath);
      }
    })
    .catch(() => {})
    .finally(() => {
      // Nothing ended up loaded for a pending path — no host mode, or the file failed to
      // open — so show the sample doc the initial synchronous render skipped for it.
      if (pendingHostPath && hostFile === null) {
        markdownEditor.value = sampleMarkdown;
        renderMarkdown();
        updateMobileStats();
      }
    });

  // Returns { status, data }; throws for anything but success or a 409 conflict
  async function hostApi(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok && res.status !== 409) {
      throw new Error(data.error || res.statusText);
    }
    return { status: res.status, data };
  }

  function hostFileUrl(path) {
    return "api/file?path=" + encodeURIComponent(path);
  }

  function hostFileMetaUrl(path) {
    return "api/file-meta?path=" + encodeURIComponent(path);
  }

  // Keeps the open host file's path in the URL via replaceState (not pushState — opening a
  // file isn't something the user expects Back to step through). path === null removes it.
  function setUrlPath(path) {
    const params = new URLSearchParams(location.search);
    if (path === null) {
      params.delete("path");
    } else {
      params.set("path", path);
    }
    const query = params.toString();
    const url = location.pathname + (query ? "?" + query : "") + location.hash;
    history.replaceState(null, "", url);
  }

  function isHostFileDirty() {
    return hostFile !== null && markdownEditor.value !== hostFile.savedContent;
  }

  function updateHostUi() {
    hostOpenButton.hidden = !hostMode;
    mobileHostOpenBtn.hidden = !hostMode;
    hostSaveButton.hidden = hostFile === null;
    mobileHostSaveBtn.hidden = hostFile === null;
    hostFileLabel.hidden = hostFile === null;
    hostFileLabel.textContent = hostFile ? (isHostFileDirty() ? "• " : "") + hostFile.path : "";
    hostFileLabel.title = hostFile ? hostFile.path : "";
    hostDiskChanged.hidden = !hostFile?.disk;
    if (hostFile?.disk) {
      const label = hostFile.disk === "deleted" ? "File was deleted on disk" : "File changed on disk — click to load it";
      hostDiskChanged.title = label;
      hostDiskChanged.setAttribute("aria-label", label);
    }
  }

  // Textarea normalizes line endings to LF, so savedContent is read back from the
  // editor and CRLF files get their line endings restored on save
  function setHostEditorContent(path, content, hash, mtime, { preserveView = false } = {}) {
    let view = null;
    if (preserveView) {
      view = {
        editorScrollTop: editorPane.scrollTop,
        selectionStart: markdownEditor.selectionStart,
        selectionEnd: markdownEditor.selectionEnd,
        previewScrollTop: previewPane.scrollTop,
      };
    }
    markdownEditor.value = content;
    renderMarkdown();
    if (view) {
      editorPane.scrollTop = view.editorScrollTop;
      const len = markdownEditor.value.length;
      markdownEditor.selectionStart = Math.min(view.selectionStart, len);
      markdownEditor.selectionEnd = Math.min(view.selectionEnd, len);
      previewPane.scrollTop = view.previewScrollTop;
    } else {
      dropzone.style.display = "none";
    }
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    hostFile = { path, hash, mtime, eol, savedContent: markdownEditor.value, disk: null };
    setUrlPath(path);
    updateHostUi();
  }

  const HOST_POLL_INTERVAL = 2000;

  // Fetches url and returns its parsed JSON, "deleted" for a 404, or null on any other
  // failure (already console.warn'd) — used by pollHostFile so a flaky poll never alerts.
  async function fetchHostJsonOrNull(url) {
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      console.warn("Polling host file failed:", e);
      return null;
    }
    if (res.status === 404) return "deleted";
    if (!res.ok) {
      console.warn("Polling host file failed:", res.status, res.statusText);
      return null;
    }
    return res.json();
  }

  // Polls the open host file's mtime for changes on disk — cheap, so it can run every
  // couple of seconds without re-fetching content that hasn't changed. Only once the
  // mtime moves do we fetch the full file, live-applying it while the editor is
  // unmodified, or otherwise recording it on hostFile.disk for the icon to surface.
  async function pollHostFile() {
    if (hostFile === null || document.visibilityState !== "visible") return;
    const file = hostFile;
    const baseMtime = file.mtime;
    const isStale = () => file !== hostFile || file.mtime !== baseMtime;

    const meta = await fetchHostJsonOrNull(hostFileMetaUrl(file.path));
    if (meta === null || isStale()) return;
    if (meta === "deleted") {
      file.disk = "deleted";
      updateHostUi();
      return;
    }
    if (meta.mtime === file.mtime) {
      file.disk = null;
      updateHostUi();
      return;
    }

    const data = await fetchHostJsonOrNull(hostFileUrl(file.path));
    if (data === null || isStale()) return;
    if (data === "deleted") {
      file.disk = "deleted";
      updateHostUi();
      return;
    }
    if (data.hash === file.hash) {
      file.mtime = data.mtime;
      file.disk = null;
    } else if (!isHostFileDirty()) {
      setHostEditorContent(file.path, data.content, data.hash, data.mtime, { preserveView: true });
      return;
    } else {
      file.disk = { hash: data.hash, content: data.content, mtime: data.mtime };
    }
    updateHostUi();
  }

  setInterval(pollHostFile, HOST_POLL_INTERVAL);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollHostFile();
  });

  hostDiskChanged.addEventListener("click", function () {
    if (!hostFile || hostFile.disk === null) return;
    const disk = hostFile.disk;
    if (disk === "deleted") return;
    if (isHostFileDirty() && !confirm("Discard your edits and load the version on disk?")) {
      return;
    }
    setHostEditorContent(hostFile.path, disk.content, disk.hash, disk.mtime);
  });

  async function openHostFile(path) {
    if (isHostFileDirty() && !confirm(`Discard unsaved changes to ${hostFile.path}?`)) {
      return;
    }
    try {
      const { data } = await hostApi(hostFileUrl(path));
      setHostEditorContent(data.path, data.content, data.hash, data.mtime);
      hostFilesModal.hide();
    } catch (e) {
      console.error("Opening host file failed:", e);
      alert("Opening file failed: " + e.message);
      // Only the URL's own path failed to open — clear it so a reload doesn't repeat the
      // alert forever. An already-open file's URL is left alone.
      if (new URLSearchParams(location.search).get("path") === path) {
        setUrlPath(null);
      }
    }
  }

  async function saveHostFile(baseHash = hostFile.hash) {
    // Keep a reference: another file may be opened while the request is in flight
    const file = hostFile;
    const content = markdownEditor.value;
    try {
      const { status, data } = await hostApi(hostFileUrl(file.path), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.replaceAll("\n", file.eol), base_hash: baseHash }),
      });
      if (file !== hostFile) return;
      if (status === 409) {
        hostConflict = data;
        hostConflictModal.show();
        return;
      }
      file.hash = data.hash;
      file.mtime = data.mtime;
      file.savedContent = content;
      file.disk = null;
      updateHostUi();
    } catch (e) {
      console.error("Save failed:", e);
      alert("Save failed: " + e.message);
    }
  }

  hostOpenButton.addEventListener("click", () => hostFilesModal.show());
  hostSaveButton.addEventListener("click", () => saveHostFile());

  // Wait until the modal has fully closed so a repeated conflict can reopen it
  hostConflictOverwrite.addEventListener("click", function () {
    const { hash } = hostConflict;
    hostConflictModalElement.addEventListener("hidden.bs.modal", () => saveHostFile(hash), { once: true });
    hostConflictModal.hide();
  });

  hostConflictLoad.addEventListener("click", function () {
    if (!confirm("Discard your edits and load the version on disk?")) {
      return;
    }
    hostConflictModal.hide();
    setHostEditorContent(hostFile.path, hostConflict.content, hostConflict.hash, hostConflict.mtime);
  });

  // Re-fetch on every open: the agent keeps creating files
  hostFilesModalElement.addEventListener("show.bs.modal", async function () {
    hostFileSearch.value = "";
    try {
      const { data } = await hostApi("api/files");
      hostRootName.textContent = data.root;
      hostFiles = data.files;
      renderHostFileList();
    } catch (e) {
      console.error("Listing host files failed:", e);
      alert("Listing files failed: " + e.message);
    }
  });

  hostFilesModalElement.addEventListener("shown.bs.modal", () => hostFileSearch.focus());
  hostFileSearch.addEventListener("input", renderHostFileList);

  hostFileSearch.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      moveHostSelection(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = hostFileList.querySelector(".host-file-item.active");
      if (selected) selected.click();
    }
  });

  // Case-insensitive subsequence match; returns null or { score, positions }
  function fuzzyScore(query, path) {
    const q = query.toLowerCase();
    const p = path.toLowerCase();
    const basenameStart = p.lastIndexOf("/") + 1;
    const positions = [];
    let score = 0;
    let index = 0;
    for (const char of q) {
      index = p.indexOf(char, index);
      if (index === -1) return null;
      score += 1;
      if (positions.length && positions[positions.length - 1] === index - 1) {
        score += 5; // consecutive run
      }
      if (index === basenameStart || "/-_.".includes(p[index - 1])) {
        score += 3; // word boundary
      }
      positions.push(index);
      index++;
    }
    return { score, positions };
  }

  function renderHostFileList() {
    const query = hostFileSearch.value.trim();
    hostFileList.replaceChildren();

    if (query) {
      hostFiles
        .map((path) => ({ path, match: fuzzyScore(query, path) }))
        .filter((result) => result.match)
        .sort((a, b) => b.match.score - a.match.score || a.path.length - b.path.length)
        .forEach((result) => {
          hostFileList.appendChild(createHostFileItem(result.path, highlightMatches(result.path, result.match.positions)));
        });
    } else {
      renderHostTree(buildHostTree(hostFiles), hostFileList);
    }

    if (!hostFileList.hasChildNodes()) {
      const empty = document.createElement("p");
      empty.className = "host-file-empty";
      empty.textContent = query ? "No matching files" : "No Markdown files found";
      hostFileList.appendChild(empty);
    }
    moveHostSelection(0);
  }

  function buildHostTree(paths) {
    const root = { dirs: new Map(), files: [] };
    paths.forEach((path) => {
      let node = root;
      path.split("/").slice(0, -1).forEach((dir) => {
        if (!node.dirs.has(dir)) {
          node.dirs.set(dir, { dirs: new Map(), files: [] });
        }
        node = node.dirs.get(dir);
      });
      node.files.push(path);
    });
    return root;
  }

  function renderHostTree(node, container) {
    node.dirs.forEach((child, name) => {
      const details = document.createElement("details");
      details.className = "host-tree-dir";
      details.open = true;
      const summary = document.createElement("summary");
      summary.innerHTML = '<i class="bi bi-folder me-2"></i>';
      summary.append(name);
      details.appendChild(summary);
      renderHostTree(child, details);
      container.appendChild(details);
    });
    node.files.forEach((path) => {
      container.appendChild(createHostFileItem(path, document.createTextNode(path.split("/").pop())));
    });
  }

  function highlightMatches(path, positions) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < path.length; i++) {
      if (positions.includes(i)) {
        const mark = document.createElement("mark");
        mark.textContent = path[i];
        fragment.appendChild(mark);
      } else {
        fragment.appendChild(document.createTextNode(path[i]));
      }
    }
    return fragment;
  }

  function createHostFileItem(path, label) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "host-file-item";
    item.title = path;
    item.innerHTML = '<i class="bi bi-file-earmark-text me-2"></i>';
    item.append(label);
    item.addEventListener("click", () => openHostFile(path));
    return item;
  }

  // Moves the highlighted row among files not hidden inside a collapsed folder
  function moveHostSelection(delta) {
    const items = [...hostFileList.querySelectorAll(".host-file-item")]
      .filter((item) => !item.parentElement.closest("details:not([open])"));
    const current = items.findIndex((item) => item.classList.contains("active"));
    hostFileList.querySelectorAll(".host-file-item.active").forEach((item) => item.classList.remove("active"));
    if (!items.length) return;
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), items.length - 1);
    items[next].classList.add("active");
    items[next].scrollIntoView({ block: "nearest" });
  }

  function createStatusOverlay(message) {
    const overlay = document.createElement("div");
    overlay.className = "status-overlay";
    overlay.innerHTML = `
      <div class="status-overlay-card">
        <div class="status-overlay-spinner" aria-hidden="true"></div>
        <p class="status-overlay-text">${message}</p>
      </div>
    `;
    document.body.appendChild(overlay);
    return {
      update(text) {
        const el = overlay.querySelector(".status-overlay-text");
        if (el) el.textContent = text;
      },
      remove() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }
    };
  }

  async function waitForImages(container) {
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) return;

    await Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          })
      )
    );
  }

  function hasUnsupportedCanvasColor(value) {
    return typeof value === "string" && value.includes("color(");
  }

  function sanitizePdfElementForCanvas(container, theme) {
    const palette = theme === "dark"
      ? {
          text: "#e5e7eb",
          bg: "#0f141c",
          border: "#3b4657",
          codeBg: "#1a2431"
        }
      : {
          text: "#1c1f26",
          bg: "#fcf6ee",
          border: "#d2c1ad",
          codeBg: "#f3ece2"
        };

    const nodes = [container, ...container.querySelectorAll("*")];
    nodes.forEach((el) => {
      const cs = window.getComputedStyle(el);

      if (hasUnsupportedCanvasColor(cs.color)) {
        el.style.color = palette.text;
      }
      if (hasUnsupportedCanvasColor(cs.backgroundColor)) {
        el.style.backgroundColor = palette.bg;
      }
      if (hasUnsupportedCanvasColor(cs.borderTopColor)) {
        el.style.borderTopColor = palette.border;
      }
      if (hasUnsupportedCanvasColor(cs.borderRightColor)) {
        el.style.borderRightColor = palette.border;
      }
      if (hasUnsupportedCanvasColor(cs.borderBottomColor)) {
        el.style.borderBottomColor = palette.border;
      }
      if (hasUnsupportedCanvasColor(cs.borderLeftColor)) {
        el.style.borderLeftColor = palette.border;
      }
      if (hasUnsupportedCanvasColor(cs.outlineColor)) {
        el.style.outlineColor = palette.border;
      }

      if (typeof cs.boxShadow === "string" && cs.boxShadow.includes("color(")) {
        el.style.boxShadow = "none";
      }
      if (typeof cs.textShadow === "string" && cs.textShadow.includes("color(")) {
        el.style.textShadow = "none";
      }
      if (typeof cs.backgroundImage === "string" && cs.backgroundImage.includes("color(")) {
        el.style.backgroundImage = "none";
      }
      if (typeof cs.filter === "string" && cs.filter !== "none") {
        el.style.filter = "none";
      }
      if (typeof cs.backdropFilter === "string" && cs.backdropFilter !== "none") {
        el.style.backdropFilter = "none";
      }
    });

    container.querySelectorAll("pre, code").forEach((el) => {
      el.style.backgroundColor = palette.codeBg;
      el.style.borderColor = palette.border;
    });
  }

  exportMd.addEventListener("click", function (event) {
    event.preventDefault();
    try {
      const blob = new Blob([markdownEditor.value], {
        type: "text/markdown;charset=utf-8",
      });
      saveAs(blob, "document.md");
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed: " + e.message);
    }
  });

  exportHtml.addEventListener("click", function (event) {
    event.preventDefault();
    try {
      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container'], 
        ADD_ATTR: ['id', 'class', 'style']
      });
      const isDarkTheme =
        document.documentElement.getAttribute("data-theme") === "dark";
      const cssTheme = isDarkTheme
        ? "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.3.0/github-markdown-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.3.0/github-markdown.min.css";
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Export</title>
  <link rel="stylesheet" href="${cssTheme}">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${
    isDarkTheme ? "github-dark" : "github"
  }.min.css">
  <style>
      body {
          background-color: ${isDarkTheme ? "#0d1117" : "#ffffff"};
          color: ${isDarkTheme ? "#c9d1d9" : "#24292e"};
      }
      .markdown-body {
          box-sizing: border-box;
          min-width: 200px;
          max-width: 980px;
          margin: 0 auto;
          padding: 45px;
          background-color: ${isDarkTheme ? "#0d1117" : "#ffffff"};
          color: ${isDarkTheme ? "#c9d1d9" : "#24292e"};
      }
      @media (max-width: 767px) {
          .markdown-body {
              padding: 15px;
          }
      }
  </style>
</head>
<body>
  <article class="markdown-body">
      ${sanitizedHtml}
  </article>
</body>
</html>`;
      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
      saveAs(blob, "document.html");
    } catch (e) {
      console.error("HTML export failed:", e);
      alert("HTML export failed: " + e.message);
    }
  });

  // ============================================
  // Page-Break Detection Functions (Story 1.1)
  // ============================================

  // Page configuration constants for A4 PDF export
  const PAGE_CONFIG = {
    a4Width: 210,           // mm
    a4Height: 297,          // mm
    margin: 15,             // mm each side
    contentWidth: 180,      // 210 - 30 (margins)
    contentHeight: 267,     // 297 - 30 (margins)
    windowWidth: 1000,      // html2canvas config
    scale: 2                // html2canvas scale factor
  };

  /**
   * Task 1: Identifies all graphic elements that may need page-break handling
   * @param {HTMLElement} container - The container element to search within
   * @returns {Array} Array of {element, type} objects
   */
  function identifyGraphicElements(container) {
    const graphics = [];

    // Query for images
    container.querySelectorAll('img').forEach(el => {
      graphics.push({ element: el, type: 'img' });
    });

    // Query for SVGs (Mermaid diagrams)
    container.querySelectorAll('svg').forEach(el => {
      graphics.push({ element: el, type: 'svg' });
    });

    // Query for pre elements (code blocks)
    container.querySelectorAll('pre').forEach(el => {
      graphics.push({ element: el, type: 'pre' });
    });

    // Query for tables
    container.querySelectorAll('table').forEach(el => {
      graphics.push({ element: el, type: 'table' });
    });

    return graphics;
  }

  /**
   * Task 2: Calculates element positions relative to the container
   * @param {Array} elements - Array of {element, type} objects
   * @param {HTMLElement} container - The container element
   * @returns {Array} Array with position data added
   */
  function calculateElementPositions(elements, container) {
    const containerRect = container.getBoundingClientRect();

    return elements.map(item => {
      const rect = item.element.getBoundingClientRect();
      const top = rect.top - containerRect.top;
      const height = rect.height;
      const bottom = top + height;

      return {
        element: item.element,
        type: item.type,
        top: top,
        height: height,
        bottom: bottom
      };
    });
  }

  /**
   * Task 3: Calculates page boundary positions
   * @param {number} totalHeight - Total height of content in pixels
   * @param {number} elementWidth - Actual width of the rendered element in pixels
   * @param {Object} pageConfig - Page configuration object
   * @returns {Array} Array of y-coordinates where pages end
   */
  function calculatePageBoundaries(totalHeight, elementWidth, pageConfig) {
    // Calculate pixel height per page based on the element's actual width
    // This must match how PDF pagination will split the canvas
    // The aspect ratio of content area determines page height relative to width
    const aspectRatio = pageConfig.contentHeight / pageConfig.contentWidth;
    const pageHeightPx = elementWidth * aspectRatio;

    const boundaries = [];
    let y = pageHeightPx;

    while (y < totalHeight) {
      boundaries.push(y);
      y += pageHeightPx;
    }

    return { boundaries, pageHeightPx };
  }

  /**
   * Task 4: Detects which elements would be split across page boundaries
   * @param {Array} elements - Array of elements with position data
   * @param {Array} pageBoundaries - Array of page break y-coordinates
   * @returns {Array} Array of split elements with additional split info
   */
  function detectSplitElements(elements, pageBoundaries) {
    // Handle edge case: empty elements array
    if (!elements || elements.length === 0) {
      return [];
    }

    // Handle edge case: no page boundaries (single page)
    if (!pageBoundaries || pageBoundaries.length === 0) {
      return [];
    }

    const splitElements = [];

    for (const item of elements) {
      // Find which page the element starts on
      let startPage = 0;
      for (let i = 0; i < pageBoundaries.length; i++) {
        if (item.top >= pageBoundaries[i]) {
          startPage = i + 1;
        } else {
          break;
        }
      }

      // Find which page the element ends on
      let endPage = 0;
      for (let i = 0; i < pageBoundaries.length; i++) {
        if (item.bottom > pageBoundaries[i]) {
          endPage = i + 1;
        } else {
          break;
        }
      }

      // Element is split if it spans multiple pages
      if (endPage > startPage) {
        // Calculate overflow amount (how much crosses into next page)
        const boundaryY = pageBoundaries[startPage] || pageBoundaries[0];
        const overflowAmount = item.bottom - boundaryY;

        splitElements.push({
          element: item.element,
          type: item.type,
          top: item.top,
          height: item.height,
          splitPageIndex: startPage,
          overflowAmount: overflowAmount
        });
      }
    }

    return splitElements;
  }

  /**
   * Task 5: Main entry point for analyzing graphics for page breaks
   * @param {HTMLElement} tempElement - The rendered content container
   * @returns {Object} Analysis result with totalElements, splitElements, pageCount
   */
  function analyzeGraphicsForPageBreaks(tempElement) {
    try {
      // Step 1: Identify all graphic elements
      const graphics = identifyGraphicElements(tempElement);
      console.log('Step 1 - Graphics found:', graphics.length, graphics.map(g => g.type));

      // Step 2: Calculate positions for each element
      const elementsWithPositions = calculateElementPositions(graphics, tempElement);
      console.log('Step 2 - Element positions:', elementsWithPositions.map(e => ({
        type: e.type,
        top: Math.round(e.top),
        height: Math.round(e.height),
        bottom: Math.round(e.bottom)
      })));

      // Step 3: Calculate page boundaries using the element's ACTUAL width
      const totalHeight = tempElement.scrollHeight;
      const elementWidth = tempElement.offsetWidth;
      const { boundaries: pageBoundaries, pageHeightPx } = calculatePageBoundaries(
        totalHeight,
        elementWidth,
        PAGE_CONFIG
      );

      console.log('Step 3 - Page boundaries:', {
        elementWidth,
        totalHeight,
        pageHeightPx: Math.round(pageHeightPx),
        boundaries: pageBoundaries.map(b => Math.round(b))
      });

      // Step 4: Detect split elements
      const splitElements = detectSplitElements(elementsWithPositions, pageBoundaries);
      console.log('Step 4 - Split elements detected:', splitElements.length);

      // Calculate page count
      const pageCount = pageBoundaries.length + 1;

      return {
        totalElements: graphics.length,
        splitElements: splitElements,
        pageCount: pageCount,
        pageBoundaries: pageBoundaries,
        pageHeightPx: pageHeightPx
      };
    } catch (error) {
      console.error('Page-break analysis failed:', error);
      return {
        totalElements: 0,
        splitElements: [],
        pageCount: 1,
        pageBoundaries: [],
        pageHeightPx: 0
      };
    }
  }

  // ============================================
  // End Page-Break Detection Functions
  // ============================================

  // ============================================
  // Page-Break Insertion Functions (Story 1.2)
  // ============================================

  // Threshold for whitespace optimization (30% of page height)
  const PAGE_BREAK_THRESHOLD = 0.3;

  /**
   * Task 3: Categorizes split elements by whether they fit on a single page
   * @param {Array} splitElements - Array of split elements from detection
   * @param {number} pageHeightPx - Page height in pixels
   * @returns {Object} { fittingElements, oversizedElements }
   */
  function categorizeBySize(splitElements, pageHeightPx) {
    const fittingElements = [];
    const oversizedElements = [];

    for (const item of splitElements) {
      if (item.height <= pageHeightPx) {
        fittingElements.push(item);
      } else {
        oversizedElements.push(item);
      }
    }

    return { fittingElements, oversizedElements };
  }

  /**
   * Task 1: Inserts page breaks by adjusting margins for fitting elements
   * @param {Array} fittingElements - Elements that fit on a single page
   * @param {number} pageHeightPx - Page height in pixels
   */
  function insertPageBreaks(fittingElements, pageHeightPx) {
    for (const item of fittingElements) {
      // Calculate where the current page ends
      const currentPageBottom = (item.splitPageIndex + 1) * pageHeightPx;

      // Calculate remaining space on current page
      const remainingSpace = currentPageBottom - item.top;
      const remainingRatio = remainingSpace / pageHeightPx;

      console.log('Processing split element:', {
        type: item.type,
        top: Math.round(item.top),
        height: Math.round(item.height),
        splitPageIndex: item.splitPageIndex,
        currentPageBottom: Math.round(currentPageBottom),
        remainingSpace: Math.round(remainingSpace),
        remainingRatio: remainingRatio.toFixed(2)
      });

      // Task 4: Whitespace optimization
      // If remaining space is more than threshold and element almost fits, skip
      // (Will be handled by Story 1.3 scaling instead)
      if (remainingRatio > PAGE_BREAK_THRESHOLD) {
        const scaledHeight = item.height * 0.9; // 90% scale
        if (scaledHeight <= remainingSpace) {
          console.log('  -> Skipping (can fit with 90% scaling)');
          continue;
        }
      }

      // Calculate margin needed to push element to next page
      const marginNeeded = currentPageBottom - item.top + 5; // 5px buffer

      console.log('  -> Applying marginTop:', marginNeeded, 'px');

      // Determine which element to apply margin to
      // For SVG elements (Mermaid diagrams), apply to parent container for proper layout
      let targetElement = item.element;
      if (item.type === 'svg' && item.element.parentElement) {
        targetElement = item.element.parentElement;
        console.log('  -> Using parent element:', targetElement.tagName, targetElement.className);
      }

      // Apply margin to push element to next page
      const currentMargin = parseFloat(targetElement.style.marginTop) || 0;
      targetElement.style.marginTop = `${currentMargin + marginNeeded}px`;

      console.log('  -> Element after margin:', targetElement.tagName, 'marginTop =', targetElement.style.marginTop);
    }
  }

  /**
   * Task 2: Applies page breaks with cascading adjustment handling
   * @param {HTMLElement} tempElement - The rendered content container
   * @param {Object} pageConfig - Page configuration object (unused, kept for API compatibility)
   * @param {number} maxIterations - Maximum iterations to prevent infinite loops
   * @returns {Object} Final analysis result
   */
  function applyPageBreaksWithCascade(tempElement, pageConfig, maxIterations = 10) {
    let iteration = 0;
    let analysis;
    let previousSplitCount = -1;

    do {
      // Re-analyze after each adjustment
      analysis = analyzeGraphicsForPageBreaks(tempElement);

      // Use pageHeightPx from analysis (calculated from actual element width)
      const pageHeightPx = analysis.pageHeightPx;

      // Categorize elements by size
      const { fittingElements, oversizedElements } = categorizeBySize(
        analysis.splitElements,
        pageHeightPx
      );

      // Store oversized elements for Story 1.3
      analysis.oversizedElements = oversizedElements;

      // If no fitting elements need adjustment, we're done
      if (fittingElements.length === 0) {
        break;
      }

      // Check if we're making progress (prevent infinite loops)
      if (fittingElements.length === previousSplitCount) {
        console.warn('Page-break adjustment not making progress, stopping');
        break;
      }
      previousSplitCount = fittingElements.length;

      // Apply page breaks to fitting elements
      insertPageBreaks(fittingElements, pageHeightPx);
      iteration++;

    } while (iteration < maxIterations);

    if (iteration >= maxIterations) {
      console.warn('Page-break stabilization reached max iterations:', maxIterations);
    }

    console.log('Page-break cascade complete:', {
      iterations: iteration,
      finalSplitCount: analysis.splitElements.length,
      oversizedCount: analysis.oversizedElements ? analysis.oversizedElements.length : 0
    });

    return analysis;
  }

  // ============================================
  // End Page-Break Insertion Functions
  // ============================================

  // ============================================
  // Oversized Graphics Scaling Functions (Story 1.3)
  // ============================================

  // Minimum scale factor to maintain readability (50%)
  const MIN_SCALE_FACTOR = 0.5;

  /**
   * Task 1 & 2: Calculates scale factor with minimum enforcement
   * @param {number} elementHeight - Original height of element in pixels
   * @param {number} availableHeight - Available page height in pixels
   * @param {number} buffer - Small buffer to prevent edge overflow
   * @returns {Object} { scaleFactor, wasClampedToMin }
   */
  function calculateScaleFactor(elementHeight, availableHeight, buffer = 5) {
    const targetHeight = availableHeight - buffer;
    let scaleFactor = targetHeight / elementHeight;
    let wasClampedToMin = false;

    // Enforce minimum scale for readability
    if (scaleFactor < MIN_SCALE_FACTOR) {
      console.warn(
        `Warning: Large graphic requires ${(scaleFactor * 100).toFixed(0)}% scaling. ` +
        `Clamping to minimum ${MIN_SCALE_FACTOR * 100}%. Content may be cut off.`
      );
      scaleFactor = MIN_SCALE_FACTOR;
      wasClampedToMin = true;
    }

    return { scaleFactor, wasClampedToMin };
  }

  /**
   * Task 3: Applies CSS transform scaling to an element
   * @param {HTMLElement} element - The element to scale
   * @param {number} scaleFactor - Scale factor (0.5 = 50%)
   * @param {string} elementType - Type of element (svg, pre, img, table)
   */
  function applyGraphicScaling(element, scaleFactor, elementType) {
    // Get original dimensions before transform
    const originalHeight = element.offsetHeight;

    // Task 4: Handle SVG elements (Mermaid diagrams)
    if (elementType === 'svg') {
      // Remove max-width constraint that may interfere
      element.style.maxWidth = 'none';
    }

    // Apply CSS transform
    element.style.transform = `scale(${scaleFactor})`;
    element.style.transformOrigin = 'top left';

    // Calculate margin adjustment to collapse visual space
    const scaledHeight = originalHeight * scaleFactor;
    const marginAdjustment = originalHeight - scaledHeight;

    // Apply negative margin to pull subsequent content up
    element.style.marginBottom = `-${marginAdjustment}px`;
  }

  /**
   * Task 6: Handles all oversized elements by applying appropriate scaling
   * @param {Array} oversizedElements - Array of oversized element data
   * @param {number} pageHeightPx - Page height in pixels
   */
  function handleOversizedElements(oversizedElements, pageHeightPx) {
    if (!oversizedElements || oversizedElements.length === 0) {
      return;
    }

    let scaledCount = 0;
    let clampedCount = 0;

    for (const item of oversizedElements) {
      // Calculate required scale factor
      const { scaleFactor, wasClampedToMin } = calculateScaleFactor(
        item.height,
        pageHeightPx
      );

      // Apply scaling to the element
      applyGraphicScaling(item.element, scaleFactor, item.type);

      scaledCount++;
      if (wasClampedToMin) {
        clampedCount++;
      }
    }

    console.log('Oversized graphics scaling complete:', {
      totalScaled: scaledCount,
      clampedToMinimum: clampedCount
    });
  }

  // ============================================
  // End Oversized Graphics Scaling Functions
  // ============================================

  exportPdf.addEventListener("click", async function (event) {
    event.preventDefault();

    let tempElement = null;
    let captureHost = null;
    let overlay = null;
    const originalText = exportPdf.innerHTML;

    try {
      exportPdf.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Generating...';
      exportPdf.classList.add("is-busy");
      overlay = createStatusOverlay("Preparing PDF...");

      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'svg', 'path', 'g', 'marker', 'defs', 'pattern', 'clipPath'],
        ADD_ATTR: ['id', 'class', 'style', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'marker-end', 'marker-start']
      });

      tempElement = document.createElement("div");
      tempElement.className = "markdown-body pdf-export";
      tempElement.innerHTML = sanitizedHtml;
      tempElement.style.padding = "16mm";
      tempElement.style.width = "190mm";
      tempElement.style.margin = "0 auto";
      tempElement.style.fontSize = "14px";
      tempElement.style.position = "relative";
      tempElement.style.left = "0";
      tempElement.style.top = "0";

      const currentTheme = document.documentElement.getAttribute("data-theme");
      tempElement.style.backgroundColor = currentTheme === "dark" ? "#0f141c" : "#fcf6ee";
      tempElement.style.color = currentTheme === "dark" ? "#e5e7eb" : "#1c1f26";

      captureHost = document.createElement("div");
      captureHost.style.position = "fixed";
      captureHost.style.left = "0";
      captureHost.style.top = "0";
      captureHost.style.width = "100vw";
      captureHost.style.maxHeight = "100vh";
      captureHost.style.overflow = "auto";
      captureHost.style.pointerEvents = "none";
      captureHost.style.zIndex = "-1";
      captureHost.style.background = "transparent";

      captureHost.appendChild(tempElement);
      document.body.appendChild(captureHost);

      await waitForImages(tempElement);
      await new Promise((resolve) => setTimeout(resolve, 120));

      overlay.update("Rendering diagrams and equations...");

      try {
        await mermaid.run({
          nodes: tempElement.querySelectorAll('.mermaid'),
          suppressErrors: true
        });
      } catch (mermaidError) {
        console.warn("Mermaid rendering issue:", mermaidError);
      }

      if (window.MathJax) {
        try {
          await MathJax.typesetPromise([tempElement]);
        } catch (mathJaxError) {
          console.warn("MathJax rendering issue:", mathJaxError);
        }

        const assistiveElements = tempElement.querySelectorAll('mjx-assistive-mml');
        assistiveElements.forEach(el => el.remove());

        const mathScripts = tempElement.querySelectorAll('script[type*="math"], script[type*="tex"]');
        mathScripts.forEach(el => el.remove());
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
      overlay.update("Creating downloadable PDF...");

      // Keep page-aware adjustments for large graphics before export.
      const pageBreakAnalysis = applyPageBreaksWithCascade(tempElement, PAGE_CONFIG);
      if (pageBreakAnalysis.oversizedElements && pageBreakAnalysis.pageHeightPx) {
        handleOversizedElements(pageBreakAnalysis.oversizedElements, pageBreakAnalysis.pageHeightPx);
      }

      // html2canvas cannot parse newer Color 4 outputs (for example color(srgb ...)).
      sanitizePdfElementForCanvas(tempElement, currentTheme);

      const canvas = await html2canvas(tempElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: currentTheme === "dark" ? "#0f141c" : "#fcf6ee",
        windowWidth: tempElement.scrollWidth,
        windowHeight: tempElement.scrollHeight
      });

      const pdf = new jspdf.jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
        hotfixes: ["px_scaling"]
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      const pxToMm = contentWidth / canvas.width;
      const pageCanvasHeight = Math.floor(contentHeight / pxToMm);
      const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const startY = i * pageCanvasHeight;
        const sliceHeight = Math.min(pageCanvasHeight, canvas.height - startY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to create PDF canvas context");
        }

        ctx.drawImage(
          canvas,
          0,
          startY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.98);
        const renderHeightMm = sliceHeight * pxToMm;
        pdf.addImage(imgData, "JPEG", margin, margin, contentWidth, renderHeightMm);
      }

      pdf.save("document.pdf");

      overlay.update("PDF is ready");
      setTimeout(() => {
        if (overlay) {
          overlay.remove();
          overlay = null;
        }
      }, 700);

      exportPdf.innerHTML = originalText;
      exportPdf.classList.remove("is-busy");
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF export failed: " + error.message);
      if (overlay) {
        overlay.remove();
      }
      exportPdf.innerHTML = originalText;
      exportPdf.classList.remove("is-busy");
    } finally {
      if (captureHost && captureHost.parentNode) {
        captureHost.parentNode.removeChild(captureHost);
      } else if (tempElement && tempElement.parentNode) {
        tempElement.parentNode.removeChild(tempElement);
      }
    }
  });

  copyMarkdownButton.addEventListener("click", function () {
    try {
      const markdownText = markdownEditor.value;
      copyToClipboard(markdownText);
    } catch (e) {
      console.error("Copy failed:", e);
      alert("Failed to copy Markdown: " + e.message);
    }
  });

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showCopiedMessage();
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          showCopiedMessage();
        } else {
          throw new Error("Copy command was unsuccessful");
        }
      }
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Failed to copy HTML: " + err.message);
    }
  }

  function showCopiedMessage() {
    const originalText = copyMarkdownButton.innerHTML;
    copyMarkdownButton.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';

    setTimeout(() => {
      copyMarkdownButton.innerHTML = originalText;
    }, 2000);
  }

  const dropEvents = ["dragenter", "dragover", "dragleave", "drop"];

  dropEvents.forEach((eventName) => {
    dropzone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    dropzone.classList.add("active");
  }

  function unhighlight() {
    dropzone.classList.remove("active");
  }

  dropzone.addEventListener("drop", handleDrop, false);
  dropzone.addEventListener("click", function (e) {
    if (e.target !== closeDropzoneBtn && !closeDropzoneBtn.contains(e.target)) {
      fileInput.click();
    }
  });
  closeDropzoneBtn.addEventListener("click", function(e) {
    e.stopPropagation(); 
    dropzone.style.display = "none";
  });

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      const file = files[0];
      const isMarkdownFile =
        file.type === "text/markdown" ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".markdown");
      if (isMarkdownFile) {
        importMarkdownFile(file);
      } else {
        alert("Please upload a Markdown file (.md or .markdown)");
      }
    }
  }

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (hostFile) {
        saveHostFile();
      } else {
        exportMd.click();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      copyMarkdownButton.click();
    }
    // Story 1.2: Only allow sync toggle shortcut when in split view
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
      e.preventDefault();
      if (currentViewMode === 'split') {
        toggleSyncScrolling();
      }
    }
  });
});