<script setup lang="ts">
import { NTooltip, useMessage } from 'naive-ui'
import {
  CONTACT_GROUP,
  CONTACT_QQ,
  CONTACT_WECHAT,
} from '../../shared/brand'
import { copyTextToClipboard } from '../../shared/export-markdown'

const message = useMessage()

async function copyContact(label: string, value: string) {
  try {
    await copyTextToClipboard(value)
    message.success(`${label}已复制`)
  } catch (error) {
    console.error('[RedCopy] 复制联系方式失败', { label, value, error })
    message.error('复制失败')
  }
}
</script>

<template>
  <footer class="app-footer">
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <button
          type="button"
          class="footer-icon footer-icon--qq"
          aria-label="复制 QQ"
          @click="copyContact('QQ', CONTACT_QQ)"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10 2C5.58 2 2 5.02 2 8.64c0 2.07 1.14 3.92 2.93 5.14-.12.98-.45 2.38-1.03 3.45 0 0 2.2-.35 3.65-1.28.76.2 1.57.31 2.45.31 4.42 0 8-3.02 8-6.64S14.42 2 10 2Zm-2.8 5.6c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm5.6 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Z"
            />
          </svg>
        </button>
      </template>
      QQ：{{ CONTACT_QQ }}（点击复制）
    </NTooltip>

    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <button
          type="button"
          class="footer-icon footer-icon--wechat"
          aria-label="复制微信号"
          @click="copyContact('微信号', CONTACT_WECHAT)"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M7.2 3C4.3 3 2 4.9 2 7.2c0 1.3.7 2.5 1.8 3.3L3.4 12l1.8-.9c.5.15 1.05.23 1.6.23.25 0 .5-.02.74-.06A3.4 3.4 0 0 1 7 10.5c0-2.5 2.2-4.5 5-4.5.3 0 .6.03.9.07C12.2 4.2 9.9 3 7.2 3Zm-1.5 2.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm3 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm4.8 2.3c-2.5 0-4.5 1.6-4.5 3.6 0 2 2 3.6 4.5 3.6.45 0 .9-.06 1.32-.17l1.38.69-.35-1.2c.9-.7 1.45-1.65 1.45-2.72 0-2-2-3.6-4.75-3.6Zm-1.6 2a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Zm3.2 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z"
            />
          </svg>
        </button>
      </template>
      微信：{{ CONTACT_WECHAT }}（点击复制）
    </NTooltip>

    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <button
          type="button"
          class="footer-icon footer-icon--group"
          aria-label="复制 QQ 交流群"
          @click="copyContact('QQ 交流群', CONTACT_GROUP)"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.5 3a3.5 3.5 0 1 0 0 7 3.42 3.42 0 0 0 1.35-.28 4.5 4.5 0 0 1 3.15 3.15A3.42 3.42 0 0 0 11 13.5a3.5 3.5 0 1 0-6.65-1.35A4.48 4.48 0 0 1 2 8.5 4.5 4.5 0 0 1 6.5 3Zm7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6.5 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
            />
          </svg>
        </button>
      </template>
      QQ 交流群：{{ CONTACT_GROUP }}（点击复制）
    </NTooltip>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid #eef0f4;
}

.footer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.footer-icon:hover {
  background: #f2f3f5;
}

.footer-icon--qq:hover {
  color: #12b7f5;
}

.footer-icon--wechat:hover {
  color: #07c160;
}

.footer-icon--group:hover {
  color: #ff2442;
}

.footer-icon svg {
  width: 16px;
  height: 16px;
}
</style>
