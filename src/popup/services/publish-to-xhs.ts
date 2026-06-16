import { openXhsPublishPage } from '../../shared/publish-xhs'

/** 侧栏：跳转到小红书图文发布页 */
export async function openPublishPage(): Promise<void> {
  await openXhsPublishPage()
}
