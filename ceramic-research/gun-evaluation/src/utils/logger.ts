// Reuse logger from Ceramic evaluation
export const logger = {
  section(title: string) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60) + '\n');
  },

  info(message: string) {
    console.log(`[INFO] ${message}`);
  },

  success(message: string) {
    console.log(`[✓] ${message}`);
  },

  error(message: string, error?: any) {
    console.error(`[✗] ${message}`, error || '');
  }
};
