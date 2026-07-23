import type { GlobalThemeOverrides } from 'naive-ui'

/* Jouleverse 品牌主题 — 覆盖 Naive UI 默认变量，强化品牌感 */
/* 主色：蓝色（#2563EB）；红色仅保留在 logo / JvLoading 硬编码处 */

export const jvLightTheme: GlobalThemeOverrides = {
  common: {
    primaryColor:        '#2563EB',
    primaryColorHover:   '#1D4ED8',
    primaryColorPressed: '#1E40AF',
    primaryColorSuppl:   '#EFF6FF',

    bodyColor:           '#F8FAFC',
    cardColor:           '#FFFFFF',
    modalColor:          '#FFFFFF',
    popoverColor:        '#FFFFFF',

    textColorBase:       '#0F172A',
    textColor1:          '#0F172A',
    textColor2:          '#475569',
    textColor3:          '#64748B',
    placeholderColor:    '#94A3B8',

    borderColor:         '#E2E8F0',
    dividerColor:        '#E2E8F0',

    hoverColor:          '#E8EEF4',

    fontFamily:          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono:      "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",

    borderRadius:        '8px',
    borderRadiusSmall:   '4px',

    successColor:        '#16A34A',
    warningColor:        '#D97706',
    errorColor:          '#DC2626',
    infoColor:           '#2563EB',
  },
  Button: {
    colorPrimary:            '#2563EB',
    colorHoverPrimary:       '#1D4ED8',
    colorPressedPrimary:     '#1E40AF',
    colorFocusPrimary:       '#1D4ED8',
    textColorPrimary:        '#FFFFFF',
    textColorHoverPrimary:   '#FFFFFF',
    textColorPressedPrimary: '#FFFFFF',
    borderRadiusMedium:      '8px',
    fontSizeMedium:          '14px',
    heightMedium:            '36px',
    paddingMedium:           '0 16px',
  },
  Tag: {
    borderRadius:   '4px',
    fontSizeMedium: '12px',
  },
  DataTable: {
    thColor:           '#F8FAFC',
    thColorHover:      '#F1F5F9',
    thFontWeight:      '600',
    tdColorHover:      '#F8FAFC',
    borderColor:       '#E2E8F0',
    fontSizeMedium:    '13px',
  },
  Input: {
    borderHover:    '1px solid #2563EB',
    borderFocus:    '1px solid #2563EB',
    boxShadowFocus: '0 0 0 2px rgba(37, 99, 235, 0.15)',
  },
}

export const jvDarkTheme: GlobalThemeOverrides = {
  common: {
    primaryColor:        '#3B82F6',
    primaryColorHover:   '#60A5FA',
    primaryColorPressed: '#2563EB',
    primaryColorSuppl:   '#1E3A5F',

    bodyColor:           '#0E0F12',
    cardColor:           '#17191D',
    modalColor:          '#17191D',
    popoverColor:        '#202329',

    textColorBase:       '#F4F4F5',
    textColor1:          '#F4F4F5',
    textColor2:          '#D4D4D8',
    textColor3:          '#A1A1AA',
    placeholderColor:    '#71717A',

    borderColor:         '#2F343D',
    dividerColor:        '#2F343D',

    hoverColor:          '#262A31',

    fontFamily:          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono:      "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",

    borderRadius:        '8px',
    borderRadiusSmall:   '4px',

    successColor:        '#4ADE80',
    warningColor:        '#FBBF24',
    errorColor:          '#F87171',
    infoColor:           '#60A5FA',
  },
  Button: {
    colorPrimary:            '#3B82F6',
    colorHoverPrimary:       '#60A5FA',
    colorPressedPrimary:     '#2563EB',
    textColorPrimary:        '#FFFFFF',
    textColorHoverPrimary:   '#FFFFFF',
    textColorPressedPrimary: '#FFFFFF',
    borderRadiusMedium:      '8px',
    fontSizeMedium:          '14px',
    heightMedium:            '36px',
    paddingMedium:           '0 16px',
  },
  Tag: {
    borderRadius:   '4px',
    fontSizeMedium: '12px',
  },
  DataTable: {
    thColor:        '#17191D',
    thColorHover:   '#202329',
    thFontWeight:   '600',
    tdColorHover:   '#202329',
    borderColor:    '#2F343D',
    fontSizeMedium: '13px',
  },
  Input: {
    borderHover:    '1px solid #3B82F6',
    borderFocus:    '1px solid #3B82F6',
    boxShadowFocus: '0 0 0 2px rgba(59, 130, 246, 0.20)',
  },
}
