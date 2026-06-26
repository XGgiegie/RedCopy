import {
  openXhsPublishPage,
  type XhsPublishContentInput,
  type XhsPublishImageInput,
  type XhsPublishOpenResult,
} from '../../shared/publish-xhs'

/** 侧栏：跳转到小红书图文发布页，并可按选定顺序上传图片 */
export async function openPublishPage(
  images: XhsPublishImageInput[] = [],
  content?: XhsPublishContentInput,
): Promise<XhsPublishOpenResult> {
  return openXhsPublishPage(images, content)
}
