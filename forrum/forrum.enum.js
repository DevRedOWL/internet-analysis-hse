export const ForrumStep = {
  GREETING: 1,
  PROFESSIONAL_STATUS: 2,
  QUIZ: 3,
  CONFIRM_PRICES: 4,
  VIEW_MEMBERS: 5,
  PROFILE: 6,
  VALIDATION: 7,
};

export const ForrumQueueJobName = {
  NOTIFICATION: 'notification',
};

export const ForrumProfessionalStatus = {
  1: 'Стартапер (выручка до 30 млн ₽ в год)',
  2: 'Предприниматель Level One (до 100 млн ₽)',
  3: 'Предприниматель Next Level (до 500 млн ₽)',
  4: 'Предприниматель 99 Level (501+ млн ₽)',
  5: 'Топ-менеджер',
};

export const ForrumSecretPhrases = ['v9ku'];

export const ForrumChallenges = [
  'Низкая работоспособность сотрудников',
  'Высокая текучесть кадров',
  'Повышенный уровень стресса среди сотрудников',
  'Быстрая смена целей / стратегии',
  'Потеря прежних опор',
];

export const ForrumChannels = {
  main: 'tg://resolve?domain=forrum_admin_bot',
  profiles: 'tg://resolve?domain=forrum_admin_bot',
};

export const ForrumProfileStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_REVIEW: 'WAITING_FOR_REVIEW',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
};
