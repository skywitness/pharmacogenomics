// ch02 場景用的純資料與小函式（不依賴 three.js，可以直接用 node 驗證）。
//
// 這裡的「示範基因」是為了教學而編造的 33 個字母（11 個密碼子），不是任何真實基因的序列。
// 但它刻意包含：起始密碼子 ATG、終止密碼子 TAA，以及一個 TGG（色胺酸，Trp）——
// TGG 的最後一個 G 換成 A 就變成終止密碼子 TGA，和 CYP2C19*3（c.636G>A,p.Trp212Ter）是同一「類型」的改變
// （事實庫 molecular-basics-23；這只是類型相同，序列並不相同）。

export const GENE = 'ATGGCTAAACATGGAGACTGGCTGTTCGAGTAA'
export const N = GENE.length // 33
export const NCOD = N / 3 // 11

// 標準遺傳密碼（NCBI translation table 1），順序 T,C,A,G × T,C,A,G × T,C,A,G。61 個指定胺基酸、3 個終止（*）。
const B = 'TCAG'
const AAS = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'
export const CODON_TABLE = {}
for (let i = 0; i < 64; i++) CODON_TABLE[B[(i >> 4) & 3] + B[(i >> 2) & 3] + B[i & 3]] = AAS[i]

// 胺基酸資料：三字母、中文名（台灣慣用譯名）、性質類別（教科書常見的粗略分法，僅用於示意「相近/差很多」）
// cls: hydrophobic 疏水 / polar 極性不帶電 / basic 鹼性（正電） / acidic 酸性（負電） / special 特殊（G、P、C）
export const AA = {
  A: ['Ala', '丙胺酸', 'hydrophobic'],
  V: ['Val', '纈胺酸', 'hydrophobic'],
  L: ['Leu', '白胺酸', 'hydrophobic'],
  I: ['Ile', '異白胺酸', 'hydrophobic'],
  M: ['Met', '甲硫胺酸', 'hydrophobic'],
  F: ['Phe', '苯丙胺酸', 'hydrophobic'],
  W: ['Trp', '色胺酸', 'hydrophobic'],
  S: ['Ser', '絲胺酸', 'polar'],
  T: ['Thr', '蘇胺酸', 'polar'],
  N: ['Asn', '天門冬醯胺', 'polar'],
  Q: ['Gln', '麩醯胺酸', 'polar'],
  Y: ['Tyr', '酪胺酸', 'polar'],
  K: ['Lys', '離胺酸', 'basic'],
  R: ['Arg', '精胺酸', 'basic'],
  H: ['His', '組胺酸', 'basic'],
  D: ['Asp', '天門冬胺酸', 'acidic'],
  E: ['Glu', '麩胺酸', 'acidic'],
  G: ['Gly', '甘胺酸', 'special'],
  P: ['Pro', '脯胺酸', 'special'],
  C: ['Cys', '半胱胺酸', 'special'],
  '*': ['Stop', '終止', 'stop'],
}
export const CLASS_ZH = { hydrophobic: '疏水性', polar: '極性（不帶電）', basic: '鹼性（帶正電）', acidic: '酸性（帶負電）', special: '特殊', stop: '終止' }

export const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' }
export const toRNA = (s) => s.replace(/T/g, 'U')
export const aaOf = (codon) => CODON_TABLE[codon]
export const aaName = (letter) => AA[letter]

/** 把序列切成密碼子並翻譯，遇到終止密碼子為止。 */
export function analyze(seq) {
  const codons = []
  for (let c = 0; c < seq.length / 3; c++) {
    const dna = seq.slice(c * 3, c * 3 + 3)
    codons.push({ dna, rna: toRNA(dna), aa: aaOf(dna) })
  }
  let stopIdx = codons.findIndex((x) => x.aa === '*')
  if (stopIdx < 0) stopIdx = codons.length - 1
  const protein = codons.slice(0, stopIdx).map((x) => x.aa)
  return { codons, stopIdx, protein, nAA: protein.length }
}

/** 比較某個密碼子「原本 → 現在」的效果。 */
export function classify(origCodon, curCodon) {
  if (origCodon === curCodon) return { kind: 'same', label: '沒有改變' }
  const a0 = aaOf(origCodon)
  const a1 = aaOf(curCodon)
  if (a0 === a1) return { kind: 'synonymous', label: '同義變異', strength: 0 }
  if (a1 === '*') return { kind: 'nonsense', label: '無義變異（提早終止）', strength: 1 }
  const conservative = AA[a0][2] === AA[a1][2]
  return { kind: 'missense', label: '錯義變異', conservative, strength: conservative ? 0.3 : 1 }
}

/** 由 GENE 上的位置（0-based 鹼基）回傳所在密碼子編號與在密碼子中的位置。 */
export const codonOfIndex = (i) => ({ c: Math.floor(i / 3), pos: i % 3 })

/** 起始與終止密碼子在本示意中鎖定（避免需要模擬起始點重新尋找/讀過終止）。 */
export const isLocked = (i) => {
  const c = Math.floor(i / 3)
  return c === 0 || c === NCOD - 1
}
