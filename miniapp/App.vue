<script>
export default {
  onLaunch() {},
  onShow() {},
  onHide() {},
}
</script>

<style>
page {
  min-height: 100%;
  color: #1a2440;
  background:
    radial-gradient(980rpx 760rpx at 8% 0%, rgba(255, 255, 255, 0.84), transparent 56%),
    radial-gradient(860rpx 700rpx at 96% 10%, rgba(255, 228, 206, 0.52), transparent 60%),
    linear-gradient(132deg, #d8f0f6 0%, #f6efe6 48%, #e4e8fb 100%);
  font-family: "PingFang SC", "Noto Sans SC", "Helvetica Neue", sans-serif;
}

view,
text,
image,
button,
input,
textarea,
scroll-view,
swiper,
swiper-item,
navigator,
form,
label,
checkbox,
radio,
picker,
rich-text {
  box-sizing: border-box;
  font-family: inherit;
}

button,
input,
textarea {
  color: inherit;
}

.ui-shell {
  min-height: 100vh;
  padding: 24rpx;
  padding-bottom: calc(174rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.ui-shell.no-tab {
  padding-bottom: 34rpx;
}

.ui-card {
  border-radius: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.66);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12rpx 28rpx rgba(35, 53, 89, 0.1);
}

.ui-header-card {
  padding: 26rpx 28rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.ui-header-main {
  flex: 1;
  min-width: 0;
}

.ui-title {
  font-size: 42rpx;
  font-weight: 700;
  color: #1a2440;
  line-height: 1.2;
}

.ui-subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(26, 36, 64, 0.54);
}

.ui-header-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.ui-profile {
  max-width: 360rpx;
  min-width: 0;
  border-radius: 20rpx;
  background: rgba(255, 247, 236, 0.95);
  padding: 12rpx 14rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ui-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #ffd9ab 0%, #fff2d8 100%);
  color: #6b4e2f;
  font-size: 28rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ui-profile-text {
  min-width: 0;
  flex: 1;
}

.ui-profile-name {
  font-size: 24rpx;
  font-weight: 700;
  color: rgba(26, 36, 64, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-profile-account {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: rgba(26, 36, 64, 0.52);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-btn-primary,
.ui-btn-ghost,
.ui-btn-soft {
  margin: 0;
  border-radius: 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  padding: 0 22rpx;
  height: 68rpx;
  line-height: 68rpx;
}

.ui-btn-primary {
  border: 0;
  color: #fff;
  background: linear-gradient(90deg, #5a8ff2 0%, #69d0dc 100%);
  box-shadow: 0 8rpx 16rpx rgba(83, 146, 238, 0.24);
}

.ui-btn-primary[disabled] {
  background: #b8c5df;
  color: rgba(255, 255, 255, 0.82);
  box-shadow: none;
}

.ui-btn-ghost {
  border: 2rpx solid #d7dfef;
  color: #4b5874;
  background: #fff;
}

.ui-btn-soft {
  border: 0;
  color: #2e57b3;
  background: rgba(95, 142, 236, 0.14);
}

.ui-input,
.ui-textarea {
  width: 100%;
  border-radius: 16rpx;
  border: 2rpx solid #d9e1f2;
  background: #f8faff;
  padding: 0 22rpx;
  font-size: 28rpx;
  color: #1f2d4a;
}

.ui-input {
  height: 84rpx;
}

.ui-textarea {
  min-height: 220rpx;
  padding-top: 18rpx;
  padding-bottom: 18rpx;
}

.ui-chip {
  display: inline-flex;
  align-items: center;
  height: 44rpx;
  padding: 0 14rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 44rpx;
}

.ui-chip.blue {
  color: #2f57b5;
  background: rgba(95, 141, 235, 0.16);
}

.ui-chip.orange {
  color: #a5641f;
  background: rgba(245, 168, 84, 0.2);
}

.ui-chip.gray {
  color: #627088;
  background: rgba(131, 145, 168, 0.18);
}

.ui-empty {
  padding: 28rpx 20rpx;
  text-align: center;
  color: rgba(26, 36, 64, 0.48);
  font-size: 24rpx;
}

.ui-card-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1a2440;
}

.ui-card-subtitle {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: rgba(26, 36, 64, 0.52);
}

.ui-btn-primary::after,
.ui-btn-ghost::after,
.ui-btn-soft::after {
  border: none;
}
</style>
