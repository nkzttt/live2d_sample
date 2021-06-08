import { setup } from "./modules/setup";

if (window.Live2DConfig) {
  const { moc, texture, motion } = window.Live2DConfig;
  if (moc && texture && motion) {
    setup(moc, texture, motion);
  }
}
