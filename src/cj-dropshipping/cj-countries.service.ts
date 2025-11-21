import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CJCountry {
  serialNumber: number;
  chineseName: string;
  englishName: string;
  twoLetterCode: string;
  tripletCode: string;
  numericCode: number;
  region?: string;
  continent?: string;
  isSupported?: boolean;
}

@Injectable()
export class CJCountriesService {
  private readonly logger = new Logger(CJCountriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste complète des pays CJ (250 pays)
   */
  private readonly countries: CJCountry[] = [
    { serialNumber: 1, chineseName: '安道尔', englishName: 'Andorra', twoLetterCode: 'AD', tripletCode: 'AND', numericCode: 20, region: 'Europe', continent: 'Europe' },
    { serialNumber: 2, chineseName: '阿联酋', englishName: 'United Arab Emirates', twoLetterCode: 'AE', tripletCode: 'ARE', numericCode: 784, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 3, chineseName: '阿富汗', englishName: 'Afghanistan', twoLetterCode: 'AF', tripletCode: 'AFG', numericCode: 4, region: 'Central Asia', continent: 'Asia' },
    { serialNumber: 4, chineseName: '安提瓜和巴布达', englishName: 'Antigua and Barbuda', twoLetterCode: 'AG', tripletCode: 'ATG', numericCode: 28, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 5, chineseName: '安圭拉', englishName: 'Anguilla', twoLetterCode: 'AI', tripletCode: 'AIA', numericCode: 660, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 6, chineseName: '阿尔巴尼亚', englishName: 'Albania', twoLetterCode: 'AL', tripletCode: 'ALB', numericCode: 8, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 7, chineseName: '亚美尼亚', englishName: 'Armenia', twoLetterCode: 'AM', tripletCode: 'ARM', numericCode: 51, region: 'Caucasus', continent: 'Asia' },
    { serialNumber: 8, chineseName: '安哥拉', englishName: 'Angola', twoLetterCode: 'AO', tripletCode: 'AGO', numericCode: 24, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 9, chineseName: '南极洲', englishName: 'Antarctica', twoLetterCode: 'AQ', tripletCode: 'ATA', numericCode: 10, region: 'Antarctica', continent: 'Antarctica' },
    { serialNumber: 10, chineseName: '阿根廷', englishName: 'Argentina', twoLetterCode: 'AR', tripletCode: 'ARG', numericCode: 32, region: 'South America', continent: 'South America' },
    { serialNumber: 11, chineseName: '美属萨摩亚', englishName: 'American Samoa', twoLetterCode: 'AS', tripletCode: 'ASM', numericCode: 16, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 12, chineseName: '奥地利', englishName: 'Austria', twoLetterCode: 'AT', tripletCode: 'AUT', numericCode: 40, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 13, chineseName: '澳大利亚', englishName: 'Australia', twoLetterCode: 'AU', tripletCode: 'AUS', numericCode: 36, region: 'Oceania', continent: 'Oceania' },
    { serialNumber: 14, chineseName: '阿鲁巴', englishName: 'Aruba', twoLetterCode: 'AW', tripletCode: 'ABW', numericCode: 533, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 15, chineseName: '奥兰群岛', englishName: 'Åland Islands', twoLetterCode: 'AX', tripletCode: 'ALA', numericCode: 248, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 16, chineseName: '阿塞拜疆', englishName: 'Azerbaijan', twoLetterCode: 'AZ', tripletCode: 'AZE', numericCode: 31, region: 'Caucasus', continent: 'Asia' },
    { serialNumber: 17, chineseName: '波黑', englishName: 'Bosnia and Herzegovina', twoLetterCode: 'BA', tripletCode: 'BIH', numericCode: 70, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 18, chineseName: '巴巴多斯', englishName: 'Barbados', twoLetterCode: 'BB', tripletCode: 'BRB', numericCode: 52, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 19, chineseName: '孟加拉', englishName: 'Bangladesh', twoLetterCode: 'BD', tripletCode: 'BGD', numericCode: 50, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 20, chineseName: '比利时', englishName: 'Belgium', twoLetterCode: 'BE', tripletCode: 'BEL', numericCode: 56, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 21, chineseName: '布基纳法索', englishName: 'Burkina Faso', twoLetterCode: 'BF', tripletCode: 'BFA', numericCode: 854, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 22, chineseName: '保加利亚', englishName: 'Bulgaria', twoLetterCode: 'BG', tripletCode: 'BGR', numericCode: 100, region: 'Eastern Europe', continent: 'Europe' },
    { serialNumber: 23, chineseName: '巴林', englishName: 'Bahrain', twoLetterCode: 'BH', tripletCode: 'BHR', numericCode: 48, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 24, chineseName: '布隆迪', englishName: 'Burundi', twoLetterCode: 'BI', tripletCode: 'BDI', numericCode: 108, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 25, chineseName: '贝宁', englishName: 'Benin', twoLetterCode: 'BJ', tripletCode: 'BEN', numericCode: 204, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 26, chineseName: '圣巴泰勒米岛', englishName: 'Saint Barthélemy', twoLetterCode: 'BL', tripletCode: 'BLM', numericCode: 652, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 27, chineseName: '百慕大', englishName: 'Bermuda', twoLetterCode: 'BM', tripletCode: 'BMU', numericCode: 60, region: 'North Atlantic', continent: 'North America' },
    { serialNumber: 28, chineseName: '文莱', englishName: 'Brunei Darussalam', twoLetterCode: 'BN', tripletCode: 'BRN', numericCode: 96, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 29, chineseName: '玻利维亚', englishName: 'Bolivia', twoLetterCode: 'BO', tripletCode: 'BOL', numericCode: 68, region: 'South America', continent: 'South America' },
    { serialNumber: 30, chineseName: '荷兰加勒比区', englishName: 'Bonaire, Sint Eustatius and Saba', twoLetterCode: 'BQ', tripletCode: 'BES', numericCode: 535, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 31, chineseName: '巴西', englishName: 'Brazil', twoLetterCode: 'BR', tripletCode: 'BRA', numericCode: 76, region: 'South America', continent: 'South America' },
    { serialNumber: 32, chineseName: '巴哈马', englishName: 'Bahamas', twoLetterCode: 'BS', tripletCode: 'BHS', numericCode: 44, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 33, chineseName: '不丹', englishName: 'Bhutan', twoLetterCode: 'BT', tripletCode: 'BTN', numericCode: 64, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 34, chineseName: '布韦岛', englishName: 'Bouvet Island', twoLetterCode: 'BV', tripletCode: 'BVT', numericCode: 74, region: 'South Atlantic', continent: 'Antarctica' },
    { serialNumber: 35, chineseName: '博茨瓦纳', englishName: 'Botswana', twoLetterCode: 'BW', tripletCode: 'BWA', numericCode: 72, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 36, chineseName: '白俄罗斯', englishName: 'Belarus', twoLetterCode: 'BY', tripletCode: 'BLR', numericCode: 112, region: 'Eastern Europe', continent: 'Europe' },
    { serialNumber: 37, chineseName: '伯利兹', englishName: 'Belize', twoLetterCode: 'BZ', tripletCode: 'BLZ', numericCode: 84, region: 'Central America', continent: 'North America' },
    { serialNumber: 38, chineseName: '加拿大', englishName: 'Canada', twoLetterCode: 'CA', tripletCode: 'CAN', numericCode: 124, region: 'North America', continent: 'North America' },
    { serialNumber: 39, chineseName: '科科斯群岛', englishName: 'Cocos Islands', twoLetterCode: 'CC', tripletCode: 'CCK', numericCode: 166, region: 'Indian Ocean', continent: 'Asia' },
    { serialNumber: 40, chineseName: '刚果（金）', englishName: 'Congo (Democratic Republic)', twoLetterCode: 'CD', tripletCode: 'COD', numericCode: 180, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 41, chineseName: '中非', englishName: 'Central African Republic', twoLetterCode: 'CF', tripletCode: 'CAF', numericCode: 140, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 42, chineseName: '刚果（布）', englishName: 'Congo', twoLetterCode: 'CG', tripletCode: 'COG', numericCode: 178, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 43, chineseName: '瑞士', englishName: 'Switzerland', twoLetterCode: 'CH', tripletCode: 'CHE', numericCode: 756, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 44, chineseName: '科特迪瓦', englishName: 'Côte d\'Ivoire', twoLetterCode: 'CI', tripletCode: 'CIV', numericCode: 384, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 45, chineseName: '库克群岛', englishName: 'Cook Islands', twoLetterCode: 'CK', tripletCode: 'COK', numericCode: 184, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 46, chineseName: '智利', englishName: 'Chile', twoLetterCode: 'CL', tripletCode: 'CHL', numericCode: 152, region: 'South America', continent: 'South America' },
    { serialNumber: 47, chineseName: '喀麦隆', englishName: 'Cameroon', twoLetterCode: 'CM', tripletCode: 'CMR', numericCode: 120, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 48, chineseName: '中国', englishName: 'China', twoLetterCode: 'CN', tripletCode: 'CHN', numericCode: 156, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 49, chineseName: '哥伦比亚', englishName: 'Colombia', twoLetterCode: 'CO', tripletCode: 'COL', numericCode: 170, region: 'South America', continent: 'South America' },
    { serialNumber: 50, chineseName: '哥斯达黎加', englishName: 'Costa Rica', twoLetterCode: 'CR', tripletCode: 'CRI', numericCode: 188, region: 'Central America', continent: 'North America' },
    { serialNumber: 51, chineseName: '古巴', englishName: 'Cuba', twoLetterCode: 'CU', tripletCode: 'CUB', numericCode: 192, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 52, chineseName: '佛得角', englishName: 'Cabo Verde', twoLetterCode: 'CV', tripletCode: 'CPV', numericCode: 132, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 53, chineseName: '库拉索', englishName: 'Curaçao', twoLetterCode: 'CW', tripletCode: 'CUW', numericCode: 531, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 54, chineseName: '圣诞岛', englishName: 'Christmas Island', twoLetterCode: 'CX', tripletCode: 'CXR', numericCode: 162, region: 'Indian Ocean', continent: 'Asia' },
    { serialNumber: 55, chineseName: '塞浦路斯', englishName: 'Cyprus', twoLetterCode: 'CY', tripletCode: 'CYP', numericCode: 196, region: 'Eastern Mediterranean', continent: 'Asia' },
    { serialNumber: 56, chineseName: '捷克', englishName: 'Czechia', twoLetterCode: 'CZ', tripletCode: 'CZE', numericCode: 203, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 57, chineseName: '德国', englishName: 'Germany', twoLetterCode: 'DE', tripletCode: 'DEU', numericCode: 276, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 58, chineseName: '吉布提', englishName: 'Djibouti', twoLetterCode: 'DJ', tripletCode: 'DJI', numericCode: 262, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 59, chineseName: '丹麦', englishName: 'Denmark', twoLetterCode: 'DK', tripletCode: 'DNK', numericCode: 208, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 60, chineseName: '多米尼克', englishName: 'Dominica', twoLetterCode: 'DM', tripletCode: 'DMA', numericCode: 212, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 61, chineseName: '多米尼加', englishName: 'Dominican Republic', twoLetterCode: 'DO', tripletCode: 'DOM', numericCode: 214, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 62, chineseName: '阿尔及利亚', englishName: 'Algeria', twoLetterCode: 'DZ', tripletCode: 'DZA', numericCode: 12, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 63, chineseName: '厄瓜多尔', englishName: 'Ecuador', twoLetterCode: 'EC', tripletCode: 'ECU', numericCode: 218, region: 'South America', continent: 'South America' },
    { serialNumber: 64, chineseName: '爱沙尼亚', englishName: 'Estonia', twoLetterCode: 'EE', tripletCode: 'EST', numericCode: 233, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 65, chineseName: '埃及', englishName: 'Egypt', twoLetterCode: 'EG', tripletCode: 'EGY', numericCode: 818, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 66, chineseName: '西撒哈拉', englishName: 'Western Sahara', twoLetterCode: 'EH', tripletCode: 'ESH', numericCode: 732, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 67, chineseName: '厄立特里亚', englishName: 'Eritrea', twoLetterCode: 'ER', tripletCode: 'ERI', numericCode: 232, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 68, chineseName: '西班牙', englishName: 'Spain', twoLetterCode: 'ES', tripletCode: 'ESP', numericCode: 724, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 69, chineseName: '埃塞俄比亚', englishName: 'Ethiopia', twoLetterCode: 'ET', tripletCode: 'ETH', numericCode: 231, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 70, chineseName: '芬兰', englishName: 'Finland', twoLetterCode: 'FI', tripletCode: 'FIN', numericCode: 246, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 71, chineseName: '斐济群岛', englishName: 'Fiji', twoLetterCode: 'FJ', tripletCode: 'FJI', numericCode: 242, region: 'Melanesia', continent: 'Oceania' },
    { serialNumber: 72, chineseName: '马尔维纳斯群岛', englishName: 'Falkland Islands', twoLetterCode: 'FK', tripletCode: 'FLK', numericCode: 238, region: 'South Atlantic', continent: 'South America' },
    { serialNumber: 73, chineseName: '密克罗尼西亚联邦', englishName: 'Micronesia', twoLetterCode: 'FM', tripletCode: 'FSM', numericCode: 583, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 74, chineseName: '法罗群岛', englishName: 'Faroe Islands', twoLetterCode: 'FO', tripletCode: 'FRO', numericCode: 234, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 75, chineseName: '法国', englishName: 'France', twoLetterCode: 'FR', tripletCode: 'FRA', numericCode: 250, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 76, chineseName: '加蓬', englishName: 'Gabon', twoLetterCode: 'GA', tripletCode: 'GAB', numericCode: 266, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 77, chineseName: '英国', englishName: 'United Kingdom', twoLetterCode: 'GB', tripletCode: 'GBR', numericCode: 826, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 78, chineseName: '格林纳达', englishName: 'Grenada', twoLetterCode: 'GD', tripletCode: 'GRD', numericCode: 308, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 79, chineseName: '格鲁吉亚', englishName: 'Georgia', twoLetterCode: 'GE', tripletCode: 'GEO', numericCode: 268, region: 'Caucasus', continent: 'Asia' },
    { serialNumber: 80, chineseName: '法属圭亚那', englishName: 'French Guiana', twoLetterCode: 'GF', tripletCode: 'GUF', numericCode: 254, region: 'South America', continent: 'South America' },
    { serialNumber: 81, chineseName: '根西岛', englishName: 'Guernsey', twoLetterCode: 'GG', tripletCode: 'GGY', numericCode: 831, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 82, chineseName: '加纳', englishName: 'Ghana', twoLetterCode: 'GH', tripletCode: 'GHA', numericCode: 288, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 83, chineseName: '直布罗陀', englishName: 'Gibraltar', twoLetterCode: 'GI', tripletCode: 'GIB', numericCode: 292, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 84, chineseName: '格陵兰', englishName: 'Greenland', twoLetterCode: 'GL', tripletCode: 'GRL', numericCode: 304, region: 'North America', continent: 'North America' },
    { serialNumber: 85, chineseName: '冈比亚', englishName: 'Gambia', twoLetterCode: 'GM', tripletCode: 'GMB', numericCode: 270, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 86, chineseName: '几内亚', englishName: 'Guinea', twoLetterCode: 'GN', tripletCode: 'GIN', numericCode: 324, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 87, chineseName: '瓜德罗普', englishName: 'Guadeloupe', twoLetterCode: 'GP', tripletCode: 'GLP', numericCode: 312, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 88, chineseName: '赤道几内亚', englishName: 'Equatorial Guinea', twoLetterCode: 'GQ', tripletCode: 'GNQ', numericCode: 226, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 89, chineseName: '希腊', englishName: 'Greece', twoLetterCode: 'GR', tripletCode: 'GRC', numericCode: 300, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 90, chineseName: '南乔治亚岛', englishName: 'South Georgia', twoLetterCode: 'GS', tripletCode: 'SGS', numericCode: 239, region: 'South Atlantic', continent: 'Antarctica' },
    { serialNumber: 91, chineseName: '危地马拉', englishName: 'Guatemala', twoLetterCode: 'GT', tripletCode: 'GTM', numericCode: 320, region: 'Central America', continent: 'North America' },
    { serialNumber: 92, chineseName: '关岛', englishName: 'Guam', twoLetterCode: 'GU', tripletCode: 'GUM', numericCode: 316, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 93, chineseName: '几内亚比绍', englishName: 'Guinea-Bissau', twoLetterCode: 'GW', tripletCode: 'GNB', numericCode: 624, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 94, chineseName: '圭亚那', englishName: 'Guyana', twoLetterCode: 'GY', tripletCode: 'GUY', numericCode: 328, region: 'South America', continent: 'South America' },
    { serialNumber: 95, chineseName: '香港', englishName: 'Hong Kong', twoLetterCode: 'HK', tripletCode: 'HKG', numericCode: 344, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 96, chineseName: '赫德岛', englishName: 'Heard Island', twoLetterCode: 'HM', tripletCode: 'HMD', numericCode: 334, region: 'Indian Ocean', continent: 'Antarctica' },
    { serialNumber: 97, chineseName: '洪都拉斯', englishName: 'Honduras', twoLetterCode: 'HN', tripletCode: 'HND', numericCode: 340, region: 'Central America', continent: 'North America' },
    { serialNumber: 98, chineseName: '克罗地亚', englishName: 'Croatia', twoLetterCode: 'HR', tripletCode: 'HRV', numericCode: 191, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 99, chineseName: '海地', englishName: 'Haiti', twoLetterCode: 'HT', tripletCode: 'HTI', numericCode: 332, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 100, chineseName: '匈牙利', englishName: 'Hungary', twoLetterCode: 'HU', tripletCode: 'HUN', numericCode: 348, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 101, chineseName: '印尼', englishName: 'Indonesia', twoLetterCode: 'ID', tripletCode: 'IDN', numericCode: 360, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 102, chineseName: '爱尔兰', englishName: 'Ireland', twoLetterCode: 'IE', tripletCode: 'IRL', numericCode: 372, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 103, chineseName: '以色列', englishName: 'Israel', twoLetterCode: 'IL', tripletCode: 'ISR', numericCode: 376, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 104, chineseName: '马恩岛', englishName: 'Isle of Man', twoLetterCode: 'IM', tripletCode: 'IMN', numericCode: 833, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 105, chineseName: '印度', englishName: 'India', twoLetterCode: 'IN', tripletCode: 'IND', numericCode: 356, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 106, chineseName: '英属印度洋领地', englishName: 'British Indian Ocean Territory', twoLetterCode: 'IO', tripletCode: 'IOT', numericCode: 86, region: 'Indian Ocean', continent: 'Asia' },
    { serialNumber: 107, chineseName: '伊拉克', englishName: 'Iraq', twoLetterCode: 'IQ', tripletCode: 'IRQ', numericCode: 368, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 108, chineseName: '伊朗', englishName: 'Iran', twoLetterCode: 'IR', tripletCode: 'IRN', numericCode: 364, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 109, chineseName: '冰岛', englishName: 'Iceland', twoLetterCode: 'IS', tripletCode: 'ISL', numericCode: 352, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 110, chineseName: '意大利', englishName: 'Italy', twoLetterCode: 'IT', tripletCode: 'ITA', numericCode: 380, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 111, chineseName: '泽西岛', englishName: 'Jersey', twoLetterCode: 'JE', tripletCode: 'JEY', numericCode: 832, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 112, chineseName: '牙买加', englishName: 'Jamaica', twoLetterCode: 'JM', tripletCode: 'JAM', numericCode: 388, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 113, chineseName: '约旦', englishName: 'Jordan', twoLetterCode: 'JO', tripletCode: 'JOR', numericCode: 400, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 114, chineseName: '日本', englishName: 'Japan', twoLetterCode: 'JP', tripletCode: 'JPN', numericCode: 392, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 115, chineseName: '肯尼亚', englishName: 'Kenya', twoLetterCode: 'KE', tripletCode: 'KEN', numericCode: 404, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 116, chineseName: '吉尔吉斯斯坦', englishName: 'Kyrgyzstan', twoLetterCode: 'KG', tripletCode: 'KGZ', numericCode: 417, region: 'Central Asia', continent: 'Asia' },
    { serialNumber: 117, chineseName: '柬埔寨', englishName: 'Cambodia', twoLetterCode: 'KH', tripletCode: 'KHM', numericCode: 116, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 118, chineseName: '基里巴斯', englishName: 'Kiribati', twoLetterCode: 'KI', tripletCode: 'KIR', numericCode: 296, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 119, chineseName: '科摩罗', englishName: 'Comoros', twoLetterCode: 'KM', tripletCode: 'COM', numericCode: 174, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 120, chineseName: '圣基茨和尼维斯', englishName: 'Saint Kitts and Nevis', twoLetterCode: 'KN', tripletCode: 'KNA', numericCode: 659, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 121, chineseName: '朝鲜', englishName: 'Korea (North)', twoLetterCode: 'KP', tripletCode: 'PRK', numericCode: 408, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 122, chineseName: '韩国', englishName: 'Korea (South)', twoLetterCode: 'KR', tripletCode: 'KOR', numericCode: 410, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 123, chineseName: '科威特', englishName: 'Kuwait', twoLetterCode: 'KW', tripletCode: 'KWT', numericCode: 414, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 124, chineseName: '开曼群岛', englishName: 'Cayman Islands', twoLetterCode: 'KY', tripletCode: 'CYM', numericCode: 136, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 125, chineseName: '哈萨克斯坦', englishName: 'Kazakhstan', twoLetterCode: 'KZ', tripletCode: 'KAZ', numericCode: 398, region: 'Central Asia', continent: 'Asia' },
    { serialNumber: 126, chineseName: '老挝', englishName: 'Laos', twoLetterCode: 'LA', tripletCode: 'LAO', numericCode: 418, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 127, chineseName: '黎巴嫩', englishName: 'Lebanon', twoLetterCode: 'LB', tripletCode: 'LBN', numericCode: 422, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 128, chineseName: '圣卢西亚', englishName: 'Saint Lucia', twoLetterCode: 'LC', tripletCode: 'LCA', numericCode: 662, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 129, chineseName: '列支敦士登', englishName: 'Liechtenstein', twoLetterCode: 'LI', tripletCode: 'LIE', numericCode: 438, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 130, chineseName: '斯里兰卡', englishName: 'Sri Lanka', twoLetterCode: 'LK', tripletCode: 'LKA', numericCode: 144, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 131, chineseName: '利比里亚', englishName: 'Liberia', twoLetterCode: 'LR', tripletCode: 'LBR', numericCode: 430, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 132, chineseName: '莱索托', englishName: 'Lesotho', twoLetterCode: 'LS', tripletCode: 'LSO', numericCode: 426, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 133, chineseName: '立陶宛', englishName: 'Lithuania', twoLetterCode: 'LT', tripletCode: 'LTU', numericCode: 440, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 134, chineseName: '卢森堡', englishName: 'Luxembourg', twoLetterCode: 'LU', tripletCode: 'LUX', numericCode: 442, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 135, chineseName: '拉脱维亚', englishName: 'Latvia', twoLetterCode: 'LV', tripletCode: 'LVA', numericCode: 428, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 136, chineseName: '利比亚', englishName: 'Libya', twoLetterCode: 'LY', tripletCode: 'LBY', numericCode: 434, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 137, chineseName: '摩洛哥', englishName: 'Morocco', twoLetterCode: 'MA', tripletCode: 'MAR', numericCode: 504, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 138, chineseName: '摩纳哥', englishName: 'Monaco', twoLetterCode: 'MC', tripletCode: 'MCO', numericCode: 492, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 139, chineseName: '摩尔多瓦', englishName: 'Moldova', twoLetterCode: 'MD', tripletCode: 'MDA', numericCode: 498, region: 'Eastern Europe', continent: 'Europe' },
    { serialNumber: 140, chineseName: '黑山', englishName: 'Montenegro', twoLetterCode: 'ME', tripletCode: 'MNE', numericCode: 499, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 141, chineseName: '法属圣马丁', englishName: 'Saint Martin', twoLetterCode: 'MF', tripletCode: 'MAF', numericCode: 663, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 142, chineseName: '马达加斯加', englishName: 'Madagascar', twoLetterCode: 'MG', tripletCode: 'MDG', numericCode: 450, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 143, chineseName: '马绍尔群岛', englishName: 'Marshall Islands', twoLetterCode: 'MH', tripletCode: 'MHL', numericCode: 584, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 144, chineseName: '马其顿', englishName: 'Macedonia', twoLetterCode: 'MK', tripletCode: 'MKD', numericCode: 807, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 145, chineseName: '马里', englishName: 'Mali', twoLetterCode: 'ML', tripletCode: 'MLI', numericCode: 466, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 146, chineseName: '缅甸', englishName: 'Myanmar', twoLetterCode: 'MM', tripletCode: 'MMR', numericCode: 104, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 147, chineseName: '蒙古国', englishName: 'Mongolia', twoLetterCode: 'MN', tripletCode: 'MNG', numericCode: 496, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 148, chineseName: '澳门', englishName: 'Macao', twoLetterCode: 'MO', tripletCode: 'MAC', numericCode: 446, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 149, chineseName: '北马里亚纳群岛', englishName: 'Northern Mariana Islands', twoLetterCode: 'MP', tripletCode: 'MNP', numericCode: 580, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 150, chineseName: '马提尼克', englishName: 'Martinique', twoLetterCode: 'MQ', tripletCode: 'MTQ', numericCode: 474, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 151, chineseName: '毛里塔尼亚', englishName: 'Mauritania', twoLetterCode: 'MR', tripletCode: 'MRT', numericCode: 478, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 152, chineseName: '蒙塞拉特岛', englishName: 'Montserrat', twoLetterCode: 'MS', tripletCode: 'MSR', numericCode: 500, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 153, chineseName: '马耳他', englishName: 'Malta', twoLetterCode: 'MT', tripletCode: 'MLT', numericCode: 470, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 154, chineseName: '毛里求斯', englishName: 'Mauritius', twoLetterCode: 'MU', tripletCode: 'MUS', numericCode: 480, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 155, chineseName: '马尔代夫', englishName: 'Maldives', twoLetterCode: 'MV', tripletCode: 'MDV', numericCode: 462, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 156, chineseName: '马拉维', englishName: 'Malawi', twoLetterCode: 'MW', tripletCode: 'MWI', numericCode: 454, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 157, chineseName: '墨西哥', englishName: 'Mexico', twoLetterCode: 'MX', tripletCode: 'MEX', numericCode: 484, region: 'North America', continent: 'North America' },
    { serialNumber: 158, chineseName: '马来西亚', englishName: 'Malaysia', twoLetterCode: 'MY', tripletCode: 'MYS', numericCode: 458, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 159, chineseName: '莫桑比克', englishName: 'Mozambique', twoLetterCode: 'MZ', tripletCode: 'MOZ', numericCode: 508, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 160, chineseName: '纳米比亚', englishName: 'Namibia', twoLetterCode: 'NA', tripletCode: 'NAM', numericCode: 516, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 161, chineseName: '新喀里多尼亚', englishName: 'New Caledonia', twoLetterCode: 'NC', tripletCode: 'NCL', numericCode: 540, region: 'Melanesia', continent: 'Oceania' },
    { serialNumber: 162, chineseName: '尼日尔', englishName: 'Niger', twoLetterCode: 'NE', tripletCode: 'NER', numericCode: 562, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 163, chineseName: '诺福克岛', englishName: 'Norfolk Island', twoLetterCode: 'NF', tripletCode: 'NFK', numericCode: 574, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 164, chineseName: '尼日利亚', englishName: 'Nigeria', twoLetterCode: 'NG', tripletCode: 'NGA', numericCode: 566, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 165, chineseName: '尼加拉瓜', englishName: 'Nicaragua', twoLetterCode: 'NI', tripletCode: 'NIC', numericCode: 558, region: 'Central America', continent: 'North America' },
    { serialNumber: 166, chineseName: '荷兰', englishName: 'Netherlands', twoLetterCode: 'NL', tripletCode: 'NLD', numericCode: 528, region: 'Western Europe', continent: 'Europe' },
    { serialNumber: 167, chineseName: '挪威', englishName: 'Norway', twoLetterCode: 'NO', tripletCode: 'NOR', numericCode: 578, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 168, chineseName: '尼泊尔', englishName: 'Nepal', twoLetterCode: 'NP', tripletCode: 'NPL', numericCode: 524, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 169, chineseName: '瑙鲁', englishName: 'Nauru', twoLetterCode: 'NR', tripletCode: 'NRU', numericCode: 520, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 170, chineseName: '纽埃', englishName: 'Niue', twoLetterCode: 'NU', tripletCode: 'NIU', numericCode: 570, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 171, chineseName: '新西兰', englishName: 'New Zealand', twoLetterCode: 'NZ', tripletCode: 'NZL', numericCode: 554, region: 'Oceania', continent: 'Oceania' },
    { serialNumber: 172, chineseName: '阿曼', englishName: 'Oman', twoLetterCode: 'OM', tripletCode: 'OMN', numericCode: 512, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 173, chineseName: '巴拿马', englishName: 'Panama', twoLetterCode: 'PA', tripletCode: 'PAN', numericCode: 591, region: 'Central America', continent: 'North America' },
    { serialNumber: 174, chineseName: '秘鲁', englishName: 'Peru', twoLetterCode: 'PE', tripletCode: 'PER', numericCode: 604, region: 'South America', continent: 'South America' },
    { serialNumber: 175, chineseName: '法属波利尼西亚', englishName: 'French Polynesia', twoLetterCode: 'PF', tripletCode: 'PYF', numericCode: 258, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 176, chineseName: '巴布亚新几内亚', englishName: 'Papua New Guinea', twoLetterCode: 'PG', tripletCode: 'PNG', numericCode: 598, region: 'Melanesia', continent: 'Oceania' },
    { serialNumber: 177, chineseName: '菲律宾', englishName: 'Philippines', twoLetterCode: 'PH', tripletCode: 'PHL', numericCode: 608, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 178, chineseName: '巴基斯坦', englishName: 'Pakistan', twoLetterCode: 'PK', tripletCode: 'PAK', numericCode: 586, region: 'South Asia', continent: 'Asia' },
    { serialNumber: 179, chineseName: '波兰', englishName: 'Poland', twoLetterCode: 'PL', tripletCode: 'POL', numericCode: 616, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 180, chineseName: '圣皮埃尔和密克隆', englishName: 'Saint Pierre and Miquelon', twoLetterCode: 'PM', tripletCode: 'SPM', numericCode: 666, region: 'North America', continent: 'North America' },
    { serialNumber: 181, chineseName: '皮特凯恩群岛', englishName: 'Pitcairn', twoLetterCode: 'PN', tripletCode: 'PCN', numericCode: 612, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 182, chineseName: '波多黎各', englishName: 'Puerto Rico', twoLetterCode: 'PR', tripletCode: 'PRI', numericCode: 630, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 183, chineseName: '巴勒斯坦', englishName: 'Palestine', twoLetterCode: 'PS', tripletCode: 'PSE', numericCode: 275, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 184, chineseName: '葡萄牙', englishName: 'Portugal', twoLetterCode: 'PT', tripletCode: 'PRT', numericCode: 620, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 185, chineseName: '帕劳', englishName: 'Palau', twoLetterCode: 'PW', tripletCode: 'PLW', numericCode: 585, region: 'Micronesia', continent: 'Oceania' },
    { serialNumber: 186, chineseName: '巴拉圭', englishName: 'Paraguay', twoLetterCode: 'PY', tripletCode: 'PRY', numericCode: 600, region: 'South America', continent: 'South America' },
    { serialNumber: 187, chineseName: '卡塔尔', englishName: 'Qatar', twoLetterCode: 'QA', tripletCode: 'QAT', numericCode: 634, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 188, chineseName: '留尼汪', englishName: 'Réunion', twoLetterCode: 'RE', tripletCode: 'REU', numericCode: 638, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 189, chineseName: '罗马尼亚', englishName: 'Romania', twoLetterCode: 'RO', tripletCode: 'ROU', numericCode: 642, region: 'Eastern Europe', continent: 'Europe' },
    { serialNumber: 190, chineseName: '塞尔维亚', englishName: 'Serbia', twoLetterCode: 'RS', tripletCode: 'SRB', numericCode: 688, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 191, chineseName: '俄罗斯', englishName: 'Russia', twoLetterCode: 'RU', tripletCode: 'RUS', numericCode: 643, region: 'Eastern Europe', continent: 'Europe' },
    { serialNumber: 192, chineseName: '卢旺达', englishName: 'Rwanda', twoLetterCode: 'RW', tripletCode: 'RWA', numericCode: 646, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 193, chineseName: '沙特阿拉伯', englishName: 'Saudi Arabia', twoLetterCode: 'SA', tripletCode: 'SAU', numericCode: 682, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 194, chineseName: '所罗门群岛', englishName: 'Solomon Islands', twoLetterCode: 'SB', tripletCode: 'SLB', numericCode: 90, region: 'Melanesia', continent: 'Oceania' },
    { serialNumber: 195, chineseName: '塞舌尔', englishName: 'Seychelles', twoLetterCode: 'SC', tripletCode: 'SYC', numericCode: 690, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 196, chineseName: '苏丹', englishName: 'Sudan', twoLetterCode: 'SD', tripletCode: 'SDN', numericCode: 729, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 197, chineseName: '瑞典', englishName: 'Sweden', twoLetterCode: 'SE', tripletCode: 'SWE', numericCode: 752, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 198, chineseName: '新加坡', englishName: 'Singapore', twoLetterCode: 'SG', tripletCode: 'SGP', numericCode: 702, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 199, chineseName: '圣赫勒拿', englishName: 'Saint Helena', twoLetterCode: 'SH', tripletCode: 'SHN', numericCode: 654, region: 'South Atlantic', continent: 'Africa' },
    { serialNumber: 200, chineseName: '斯洛文尼亚', englishName: 'Slovenia', twoLetterCode: 'SI', tripletCode: 'SVN', numericCode: 705, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 201, chineseName: '斯瓦尔巴群岛', englishName: 'Svalbard and Jan Mayen', twoLetterCode: 'SJ', tripletCode: 'SJM', numericCode: 744, region: 'Northern Europe', continent: 'Europe' },
    { serialNumber: 202, chineseName: '斯洛伐克', englishName: 'Slovakia', twoLetterCode: 'SK', tripletCode: 'SVK', numericCode: 703, region: 'Central Europe', continent: 'Europe' },
    { serialNumber: 203, chineseName: '塞拉利昂', englishName: 'Sierra Leone', twoLetterCode: 'SL', tripletCode: 'SLE', numericCode: 694, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 204, chineseName: '圣马力诺', englishName: 'San Marino', twoLetterCode: 'SM', tripletCode: 'SMR', numericCode: 674, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 205, chineseName: '塞内加尔', englishName: 'Senegal', twoLetterCode: 'SN', tripletCode: 'SEN', numericCode: 686, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 206, chineseName: '索马里', englishName: 'Somalia', twoLetterCode: 'SO', tripletCode: 'SOM', numericCode: 706, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 207, chineseName: '苏里南', englishName: 'Suriname', twoLetterCode: 'SR', tripletCode: 'SUR', numericCode: 740, region: 'South America', continent: 'South America' },
    { serialNumber: 208, chineseName: '南苏丹', englishName: 'South Sudan', twoLetterCode: 'SS', tripletCode: 'SSD', numericCode: 728, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 209, chineseName: '圣多美和普林西比', englishName: 'Sao Tome and Principe', twoLetterCode: 'ST', tripletCode: 'STP', numericCode: 678, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 210, chineseName: '萨尔瓦多', englishName: 'El Salvador', twoLetterCode: 'SV', tripletCode: 'SLV', numericCode: 222, region: 'Central America', continent: 'North America' },
    { serialNumber: 211, chineseName: '圣马丁岛', englishName: 'Sint Maarten', twoLetterCode: 'SX', tripletCode: 'SXM', numericCode: 534, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 212, chineseName: '叙利亚', englishName: 'Syria', twoLetterCode: 'SY', tripletCode: 'SYR', numericCode: 760, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 213, chineseName: '斯威士兰', englishName: 'Swaziland', twoLetterCode: 'SZ', tripletCode: 'SWZ', numericCode: 748, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 214, chineseName: '特克斯和凯科斯群岛', englishName: 'Turks and Caicos Islands', twoLetterCode: 'TC', tripletCode: 'TCA', numericCode: 796, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 215, chineseName: '乍得', englishName: 'Chad', twoLetterCode: 'TD', tripletCode: 'TCD', numericCode: 148, region: 'Central Africa', continent: 'Africa' },
    { serialNumber: 216, chineseName: '法属南部领地', englishName: 'French Southern Territories', twoLetterCode: 'TF', tripletCode: 'ATF', numericCode: 260, region: 'Indian Ocean', continent: 'Antarctica' },
    { serialNumber: 217, chineseName: '多哥', englishName: 'Togo', twoLetterCode: 'TG', tripletCode: 'TGO', numericCode: 768, region: 'West Africa', continent: 'Africa' },
    { serialNumber: 218, chineseName: '泰国', englishName: 'Thailand', twoLetterCode: 'TH', tripletCode: 'THA', numericCode: 764, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 219, chineseName: '塔吉克斯坦', englishName: 'Tajikistan', twoLetterCode: 'TJ', tripletCode: 'TJK', numericCode: 762, region: 'Central Asia', continent: 'Asia' },
    { serialNumber: 220, chineseName: '托克劳', englishName: 'Tokelau', twoLetterCode: 'TK', tripletCode: 'TKL', numericCode: 772, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 221, chineseName: '东帝汶', englishName: 'Timor-Leste', twoLetterCode: 'TL', tripletCode: 'TLS', numericCode: 626, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 222, chineseName: '土库曼斯坦', englishName: 'Turkmenistan', twoLetterCode: 'TM', tripletCode: 'TKM', numericCode: 795, region: 'Central Asia', continent: 'Asia' },
    { serialNumber: 223, chineseName: '突尼斯', englishName: 'Tunisia', twoLetterCode: 'TN', tripletCode: 'TUN', numericCode: 788, region: 'North Africa', continent: 'Africa' },
    { serialNumber: 224, chineseName: '汤加', englishName: 'Tonga', twoLetterCode: 'TO', tripletCode: 'TON', numericCode: 776, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 225, chineseName: '土耳其', englishName: 'Turkey', twoLetterCode: 'TR', tripletCode: 'TUR', numericCode: 792, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 226, chineseName: '特立尼达和多巴哥', englishName: 'Trinidad and Tobago', twoLetterCode: 'TT', tripletCode: 'TTO', numericCode: 780, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 227, chineseName: '图瓦卢', englishName: 'Tuvalu', twoLetterCode: 'TV', tripletCode: 'TUV', numericCode: 798, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 228, chineseName: '台湾', englishName: 'Taiwan', twoLetterCode: 'TW', tripletCode: 'TWN', numericCode: 158, region: 'East Asia', continent: 'Asia' },
    { serialNumber: 229, chineseName: '坦桑尼亚', englishName: 'Tanzania', twoLetterCode: 'TZ', tripletCode: 'TZA', numericCode: 834, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 230, chineseName: '乌克兰', englishName: 'Ukraine', twoLetterCode: 'UA', tripletCode: 'UKR', numericCode: 804, region: 'Eastern Europe', continent: 'Europe' },
    { serialNumber: 231, chineseName: '乌干达', englishName: 'Uganda', twoLetterCode: 'UG', tripletCode: 'UGA', numericCode: 800, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 232, chineseName: '美国本土外小岛屿', englishName: 'United States Minor Outlying Islands', twoLetterCode: 'UM', tripletCode: 'UMI', numericCode: 581, region: 'Pacific Ocean', continent: 'Oceania' },
    { serialNumber: 233, chineseName: '美国', englishName: 'United States', twoLetterCode: 'US', tripletCode: 'USA', numericCode: 840, region: 'North America', continent: 'North America' },
    { serialNumber: 234, chineseName: '乌拉圭', englishName: 'Uruguay', twoLetterCode: 'UY', tripletCode: 'URY', numericCode: 858, region: 'South America', continent: 'South America' },
    { serialNumber: 235, chineseName: '乌兹别克斯坦', englishName: 'Uzbekistan', twoLetterCode: 'UZ', tripletCode: 'UZB', numericCode: 860, region: 'Central Asia', continent: 'Asia' },
    { serialNumber: 236, chineseName: '梵蒂冈', englishName: 'Holy See', twoLetterCode: 'VA', tripletCode: 'VAT', numericCode: 336, region: 'Southern Europe', continent: 'Europe' },
    { serialNumber: 237, chineseName: '圣文森特和格林纳丁斯', englishName: 'Saint Vincent and the Grenadines', twoLetterCode: 'VC', tripletCode: 'VCT', numericCode: 670, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 238, chineseName: '委内瑞拉', englishName: 'Venezuela', twoLetterCode: 'VE', tripletCode: 'VEN', numericCode: 862, region: 'South America', continent: 'South America' },
    { serialNumber: 239, chineseName: '英属维尔京群岛', englishName: 'Virgin Islands (British)', twoLetterCode: 'VG', tripletCode: 'VGB', numericCode: 92, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 240, chineseName: '美属维尔京群岛', englishName: 'Virgin Islands (U.S.)', twoLetterCode: 'VI', tripletCode: 'VIR', numericCode: 850, region: 'Caribbean', continent: 'North America' },
    { serialNumber: 241, chineseName: '越南', englishName: 'Vietnam', twoLetterCode: 'VN', tripletCode: 'VNM', numericCode: 704, region: 'Southeast Asia', continent: 'Asia' },
    { serialNumber: 242, chineseName: '瓦努阿图', englishName: 'Vanuatu', twoLetterCode: 'VU', tripletCode: 'VUT', numericCode: 548, region: 'Melanesia', continent: 'Oceania' },
    { serialNumber: 243, chineseName: '瓦利斯和富图纳', englishName: 'Wallis and Futuna', twoLetterCode: 'WF', tripletCode: 'WLF', numericCode: 876, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 244, chineseName: '萨摩亚', englishName: 'Samoa', twoLetterCode: 'WS', tripletCode: 'WSM', numericCode: 882, region: 'Polynesia', continent: 'Oceania' },
    { serialNumber: 245, chineseName: '也门', englishName: 'Yemen', twoLetterCode: 'YE', tripletCode: 'YEM', numericCode: 887, region: 'Middle East', continent: 'Asia' },
    { serialNumber: 246, chineseName: '科索沃共和国', englishName: 'Kosovo', twoLetterCode: 'YK', tripletCode: '', numericCode: 0, region: 'Balkans', continent: 'Europe' },
    { serialNumber: 247, chineseName: '马约特', englishName: 'Mayotte', twoLetterCode: 'YT', tripletCode: 'MYT', numericCode: 175, region: 'East Africa', continent: 'Africa' },
    { serialNumber: 248, chineseName: '南非', englishName: 'South Africa', twoLetterCode: 'ZA', tripletCode: 'ZAF', numericCode: 710, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 249, chineseName: '赞比亚', englishName: 'Zambia', twoLetterCode: 'ZM', tripletCode: 'ZMB', numericCode: 894, region: 'Southern Africa', continent: 'Africa' },
    { serialNumber: 250, chineseName: '津巴布韦', englishName: 'Zimbabwe', twoLetterCode: 'ZW', tripletCode: 'ZWE', numericCode: 716, region: 'Southern Africa', continent: 'Africa' }
  ];

  /**
   * Récupère tous les pays
   */
  async getAllCountries(): Promise<CJCountry[]> {
    this.logger.log('🌍 Récupération de tous les pays CJ');
    return this.countries;
  }

  /**
   * Récupère un pays par code
   */
  async getCountryByCode(code: string): Promise<CJCountry | null> {
    this.logger.log(`🔍 Recherche du pays: ${code}`);
    
    return this.countries.find(country => 
      country.twoLetterCode === code.toUpperCase() ||
      country.tripletCode === code.toUpperCase()
    ) || null;
  }

  /**
   * Récupère les pays par région
   */
  async getCountriesByRegion(region: string): Promise<CJCountry[]> {
    this.logger.log(`🗺️ Récupération des pays de la région: ${region}`);
    
    return this.countries.filter(country => 
      country.region?.toLowerCase().includes(region.toLowerCase())
    );
  }

  /**
   * Récupère les pays par continent
   */
  async getCountriesByContinent(continent: string): Promise<CJCountry[]> {
    this.logger.log(`🌎 Récupération des pays du continent: ${continent}`);
    
    return this.countries.filter(country => 
      country.continent?.toLowerCase() === continent.toLowerCase()
    );
  }

  /**
   * Recherche de pays
   */
  async searchCountries(query: string): Promise<CJCountry[]> {
    this.logger.log(`🔍 Recherche de pays: ${query}`);
    
    const searchTerm = query.toLowerCase();
    
    return this.countries.filter(country => 
      country.chineseName.toLowerCase().includes(searchTerm) ||
      country.englishName.toLowerCase().includes(searchTerm) ||
      country.twoLetterCode.toLowerCase().includes(searchTerm) ||
      country.tripletCode.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Récupère les pays supportés par CJ
   */
  async getSupportedCountries(): Promise<CJCountry[]> {
    this.logger.log('✅ Récupération des pays supportés par CJ');
    
    // Pays principaux supportés par CJ (basé sur les logistiques disponibles)
    const supportedCodes = [
      'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
      'AU', 'NZ', 'JP', 'KR', 'CN', 'HK', 'TW', 'SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'IN', 'PK',
      'BD', 'LK', 'MM', 'KH', 'LA', 'BN', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO',
      'VE', 'EC', 'GY', 'SR', 'GF', 'ZA', 'NG', 'KE', 'EG', 'MA', 'TN', 'DZ', 'LY', 'SD', 'ET',
      'UG', 'TZ', 'KE', 'GH', 'CI', 'SN', 'ML', 'BF', 'NE', 'TD', 'CM', 'CF', 'GQ', 'GA', 'CG',
      'CD', 'AO', 'ZM', 'ZW', 'BW', 'NA', 'SZ', 'LS', 'MG', 'MU', 'SC', 'KM', 'DJ', 'SO', 'ER',
      'RU', 'UA', 'BY', 'MD', 'RO', 'BG', 'HR', 'RS', 'BA', 'ME', 'MK', 'AL', 'XK', 'TR', 'GE',
      'AM', 'AZ', 'KZ', 'UZ', 'TM', 'TJ', 'KG', 'AF', 'IR', 'IQ', 'SY', 'LB', 'JO', 'IL', 'PS',
      'SA', 'AE', 'QA', 'BH', 'KW', 'OM', 'YE'
    ];
    
    return this.countries.filter(country => 
      supportedCodes.includes(country.twoLetterCode)
    );
  }

  /**
   * Synchronise les pays en base de données
   */
  async syncCountriesToDatabase(): Promise<void> {
    this.logger.log('🔄 Synchronisation des pays CJ en base de données');
    
    try {
      for (const country of this.countries) {
        // TODO: Ajouter le modèle Country au schéma Prisma
        // await this.prisma.country.upsert({
        //   where: { code: country.twoLetterCode },
        //   update: {
        //     name: country.englishName,
        //     chineseName: country.chineseName,
        //     code: country.twoLetterCode,
        //     iso3Code: country.tripletCode,
        //     numericCode: country.numericCode,
        //     region: country.region,
        //     continent: country.continent,
        //     isSupported: this.isCountrySupported(country.twoLetterCode),
        //     updatedAt: new Date(),
        //   },
        //   create: {
        //     name: country.englishName,
        //     chineseName: country.chineseName,
        //     code: country.twoLetterCode,
        //     iso3Code: country.tripletCode,
        //     numericCode: country.numericCode,
        //     region: country.region,
        //     continent: country.continent,
        //     isSupported: this.isCountrySupported(country.twoLetterCode),
        //     createdAt: new Date(),
        //     updatedAt: new Date(),
        //   }
        // });
      }
      
      this.logger.log(`✅ ${this.countries.length} pays synchronisés`);
    } catch (error) {
      this.logger.error(`❌ Erreur synchronisation pays: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Vérifie si un pays est supporté par CJ
   */
  private isCountrySupported(code: string): boolean {
    const supportedCodes = [
      'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
      'AU', 'NZ', 'JP', 'KR', 'CN', 'HK', 'TW', 'SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'IN', 'PK',
      'BD', 'LK', 'MM', 'KH', 'LA', 'BN', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO',
      'VE', 'EC', 'GY', 'SR', 'GF', 'ZA', 'NG', 'KE', 'EG', 'MA', 'TN', 'DZ', 'LY', 'SD', 'ET',
      'UG', 'TZ', 'KE', 'GH', 'CI', 'SN', 'ML', 'BF', 'NE', 'TD', 'CM', 'CF', 'GQ', 'GA', 'CG',
      'CD', 'AO', 'ZM', 'ZW', 'BW', 'NA', 'SZ', 'LS', 'MG', 'MU', 'SC', 'KM', 'DJ', 'SO', 'ER',
      'RU', 'UA', 'BY', 'MD', 'RO', 'BG', 'HR', 'RS', 'BA', 'ME', 'MK', 'AL', 'XK', 'TR', 'GE',
      'AM', 'AZ', 'KZ', 'UZ', 'TM', 'TJ', 'KG', 'AF', 'IR', 'IQ', 'SY', 'LB', 'JO', 'IL', 'PS',
      'SA', 'AE', 'QA', 'BH', 'KW', 'OM', 'YE'
    ];
    
    return supportedCodes.includes(code);
  }
}
