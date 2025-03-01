<!-- FilePreview.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue';
import UserAvatar from "@/components/UserAvatar.vue";
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

interface Props {
  src: string;
  filename: string;
  author: string;
  timestamp: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'preview', src: string): void;
}>();

const thumbnailCanvas = ref<HTMLCanvasElement | null>(null);
const imagePreview = ref<HTMLImageElement | null>(null);
const isLoadingThumbnail = ref(false);
const isLoadingImage = ref(false);
const thumbnailError = ref<string | null>(null);
const showPreview = ref(false);

const fileExtension = computed(() => {
  const ext = props.filename.split('.').pop()?.toLowerCase() || '';
  return ext;
});

const fileType = computed(() => {
  const ext = fileExtension.value;
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['ppt', 'pptx'].includes(ext)) return 'powerpoint';
  if (['txt', 'rtf', 'md'].includes(ext)) return 'text';
  if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'generic';
});

const fileIcon = computed(() => {
  switch (fileType.value) {
    case 'pdf':
      return `<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />`;
    case 'word':
      return `<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />`;
    case 'excel':
      return `<path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v6a1 1 0 102 0V8zm2-1a1 1 0 011 1v6a1 1 0 11-2 0V8a1 1 0 011-1z" clip-rule="evenodd" />`;
    case 'powerpoint':
      return `<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />`;
    case 'archive':
      return `<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clip-rule="evenodd" />`;
    default:
      return `<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />`;
  }
});

const fileColor = computed(() => {
  switch (fileType.value) {
    case 'pdf':
      return 'text-red-400';
    case 'word':
      return 'text-blue-400';
    case 'excel':
      return 'text-green-400';
    case 'powerpoint':
      return 'text-orange-400';
    case 'archive':
      return 'text-yellow-400';
    default:
      return 'text-slate-400';
  }
});

const showOverlay = computed(() => {
  if (fileType.value === 'pdf') return !isLoadingThumbnail.value;
  if (fileType.value === 'image') return !isLoadingImage.value;
  return false;
});

const generatePdfThumbnail = async (retryCount = 0) => {
  if (!props.src || fileType.value !== 'pdf') return;
  
  try {
    isLoadingThumbnail.value = true;
    thumbnailError.value = null;

    // Wait for next tick to ensure canvas is mounted
    await nextTick();
    
    if (!thumbnailCanvas.value) {
      // Retry up to 3 times with increasing delays
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
        return generatePdfThumbnail(retryCount + 1);
      }
      throw new Error('Canvas element not found');
    }

    // Dynamically import PDF.js only when needed
    const pdfjsLib = await import('pdfjs-dist');
    // Configure the worker source using Vite's asset handling
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

    const loadingTask = pdfjsLib.getDocument(props.src);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = thumbnailCanvas.value;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

  } catch (error) {
    console.error('Error generating PDF thumbnail:', error);
    thumbnailError.value = 'Failed to generate thumbnail';
  } finally {
    isLoadingThumbnail.value = false;
  }
};

const loadImagePreview = async () => {
  if (!props.src || fileType.value !== 'image') return;

  try {
    isLoadingImage.value = true;
    thumbnailError.value = null;

    // Create a new image and wait for it to load
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = props.src;
    });

    imagePreview.value = img;
  } catch (error) {
    console.error('Error loading image preview:', error);
    thumbnailError.value = 'Failed to load image';
  } finally {
    isLoadingImage.value = false;
  }
};

const openPreview = () => {
  if (fileType.value === 'pdf' || fileType.value === 'image') {
    showPreview.value = true;
    emit('preview', props.src);
  }
};

onMounted(async () => {
  if (fileType.value === 'pdf') {
    // Wait a bit before attempting to generate the thumbnail
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    generatePdfThumbnail();
  } else if (fileType.value === 'image') {
    await loadImagePreview();
  }
});
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-3">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <UserAvatar :name="author" :showName="false" />
        <div class="flex flex-col">
          <span class="text-sm text-slate-200">{{ author }}</span>
          <span class="text-xs text-slate-400">{{ timestamp }}</span>
        </div>
      </div>
    </div>

    <div class="flex gap-3 bg-slate-900/50 rounded-lg p-3">
      <!-- File Preview/Thumbnail -->
      <div class="flex-shrink-0 w-48 h-64 flex items-center justify-center rounded-lg overflow-hidden bg-slate-800 relative group">
        <!-- Loading Spinner -->
        <div v-if="isLoadingThumbnail || isLoadingImage" class="flex items-center justify-center w-full h-full">
          <svg class="animate-spin h-6 w-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>

        <!-- PDF Preview -->
        <canvas 
          v-if="fileType === 'pdf' && !isLoadingThumbnail"
          ref="thumbnailCanvas"
          class="w-full h-full object-contain"
        ></canvas>

        <!-- Image Preview -->
        <img 
          v-if="fileType === 'image' && !isLoadingImage"
          ref="imagePreview"
          :src="src" 
          :alt="filename" 
          class="w-full h-full object-cover"
        >

        <!-- File Icon for other types -->
        <div v-if="!['pdf', 'image'].includes(fileType)" :class="['p-3 rounded-lg', fileColor]">
          <svg class="w-12 h-12" viewBox="0 0 20 20" fill="currentColor">
            <path v-html="fileIcon"></path>
          </svg>
        </div>

        <!-- Preview Overlay - shared between PDF and Image -->
        <div 
          v-if="showOverlay"
          class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
          @click="openPreview"
        >
          <svg class="w-8 h-8 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>

      <div class="min-w-0 flex flex-col justify-between">
        <div class="flex items-start gap-2">
          <div class="flex-grow">
            <span class="text-sm text-slate-200 line-clamp-2">{{ filename }}</span>
            <span class="text-xs text-slate-400 uppercase mt-1 block">{{ fileExtension }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 justify-end mt-2">
          <a
            :href="src"
            target="_blank"
            class="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
            :download="filename"
          >
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            Download
          </a>
        </div>
      </div>
    </div>
  </div>
</template> 