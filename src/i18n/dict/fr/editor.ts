// Dictionnaire FR (fragmentation par domaine, clé = texte chinois d’origine). Les fichiers de données sont exemptés de la limite de lignes.
// Source : src/editor/types.ts, libellés UI des constantes de haut niveau (le corps des constantes reste en chinois, l’usage passe par t(label)).
// Les libellés dynamiques v1 de l’historique d’annulation / des données projet stockés dans reduce/store n’entrent pas dans l’i18n (voir les règles de scan).
export default {
  // ZOOM_SHAPE_LABELS
  '冲击': 'Impact',
  '推进拉回': 'Avant-arrière',
  '慢推': 'Zoom lent',
  '瞬时': 'Instantané',
  '拉远': 'Zoom arrière',
  '缓入推近': 'Zoom avant progressif',
  '弹性推近': 'Zoom avant élastique',
  '快切推近': 'Zoom avant sec',
  '心跳脉冲': 'Pulsation',
  '甩入推近': 'Zoom avant fouetté',
  // TRANSITION_LABELS
  '推进转场': 'Zoom d’anticipation',
  '白色划线转场': 'Balayage ligne blanche',
  '叠化转场': 'Fondu enchaîné',
  '闪黑转场': 'Fondu au noir',
  '闪白转场': 'Flash blanc',
  '冲击抖动转场': 'Secousse d’impact',
  '叠加转场': 'Fusion luma',
  '光溶转场': 'Dissolution organique',
  '翻页转场': 'Tourne de page',
  '焦点转场': 'Bascule de point',
  '柔化擦除转场': 'Volet adouci',
  '甩镜转场': 'Filé fouetté',
  '圆形擦除转场': 'Volet circulaire',
  '人声分离失败，未修改任何片段。': 'Échec de l’isolation de la voix ; aucun clip modifié.',
  '响度分析失败，未修改任何片段。': 'Échec de l’analyse de sonie ; aucun clip modifié.',
  '所选片段的源素材已变化，旧的人声分离结果已丢弃。请重试。': 'Le média source du clip a changé ; l’ancien résultat de séparation de la voix a été écarté. Réessayer.',
  '横向缩放': 'Échelle horizontale',
  '纵向缩放': 'Échelle verticale',
} as Record<string, string>;
