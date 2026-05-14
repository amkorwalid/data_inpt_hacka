import { getNarratableTeeth } from "@/lib/spatialContext";
import { type MentorLanguage, type ScriptEvent } from "@/types/script";
import type { SpatialContext } from "@/types/thakaamed";

const DEMO_SCRIPT: Record<MentorLanguage, ScriptEvent[]> = {
  en: [
    { type: "speak", text: "Welcome to DentalMentor AI. We will review six teaching teeth from this panoramic radiograph." },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "16" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "16", color: "red", opacity: 0.35, label: "Caries" } },
    { type: "speak", text: "Tooth sixteen shows distal caries with supporting vertical bone loss, so this quadrant deserves early attention." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "26" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "26", color: "red", opacity: 0.35, label: "Periapical lesion" } },
    { type: "speak", text: "Now compare tooth twenty-six. The pulpal space is involved and there is a periapical lesion near the roots." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "36" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "36", color: "blue", opacity: 0.35, label: "Root-canal post" } },
    { type: "speak", text: "Tooth thirty-six has heavy restorative history with a post and root-canal filling, but it still needs careful recurrent caries review." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "47" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "47", color: "red", opacity: 0.35, label: "Pulp involvement" } },
    { type: "speak", text: "Finally, tooth forty-seven shows caries tracking toward the pulp, making it a useful lower-right teaching example." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "speak", text: "Session complete. Use the findings list to jump back to any tooth for a closer review." },
  ],
  fr: [
    { type: "speak", text: "Bienvenue dans DentalMentor AI. Nous allons revoir six dents pédagogiques sur cette panoramique." },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "16" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "16", color: "red", opacity: 0.35, label: "Caries" } },
    { type: "speak", text: "La dent seize présente une carie distale avec perte osseuse verticale, donc cette zone mérite une attention précoce." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "26" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "26", color: "red", opacity: 0.35, label: "Lésion périapicale" } },
    { type: "speak", text: "Comparez maintenant la dent vingt-six. L'espace pulpaire est concerné et une lésion périapicale apparaît près des racines." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "36" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "36", color: "blue", opacity: 0.35, label: "Poste endodontique" } },
    { type: "speak", text: "La dent trente-six montre une restauration importante avec un tenon et un traitement endodontique, mais une carie secondaire reste à rechercher." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "47" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "47", color: "red", opacity: 0.35, label: "Atteinte pulpaire" } },
    { type: "speak", text: "Enfin, la dent quarante-sept présente une carie qui progresse vers la pulpe, un bon exemple pédagogique du quadrant inférieur droit." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "speak", text: "Séance terminée. Utilisez la liste des résultats pour revenir sur n'importe quelle dent." },
  ],
  ar: [
    { type: "speak", text: "مرحباً بك في DentalMentor AI. سنراجع ستة أسنان تعليمية في هذه الأشعة البانورامية." },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "16" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "16", color: "red", opacity: 0.35, label: "Caries" } },
    { type: "speak", text: "السن 16 يظهر نخرًا بعيدياً مع فقدان عظمي عمودي، لذلك يحتاج هذا الموضع إلى متابعة مبكرة." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "26" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "26", color: "red", opacity: 0.35, label: "آفة حول الذروة" } },
    { type: "speak", text: "الآن قارن السن 26. هناك امتداد إلى اللب مع آفة حول الذروة قرب الجذور." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "36" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "36", color: "blue", opacity: 0.35, label: "معالجة لبية" } },
    { type: "speak", text: "السن 36 لديه تاريخ ترميمي واضح مع وتد وحشو قنوات، ومع ذلك يجب الانتباه إلى احتمال النخر الناكس." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: "47" } },
    { type: "canvas", tool: "highlight_region", input: { tooth_id: "47", color: "red", opacity: 0.35, label: "امتداد لبّي" } },
    { type: "speak", text: "أخيراً، السن 47 يُظهر نخرًا متجهاً نحو اللب، وهو مثال تعليمي جيد في الربع السفلي الأيمن." },
    { type: "canvas", tool: "reset_view", input: {} },
    { type: "speak", text: "انتهت الجلسة. يمكنك استخدام قائمة النتائج للعودة إلى أي سن ومراجعته من جديد." },
  ],
};

export function getDemoScript(language: MentorLanguage): ScriptEvent[] {
  return DEMO_SCRIPT[language];
}

export function buildFallbackMentorScript(
  spatialContext: SpatialContext,
  language: MentorLanguage,
): ScriptEvent[] {
  const intro: Record<MentorLanguage, string> = {
    en: "The live mentor is unavailable, so here is a rule-based walkthrough of the most important teeth.",
    fr: "Le mentor en direct est indisponible, voici donc un parcours basé sur des règles pour les dents les plus importantes.",
    ar: "الموجّه المباشر غير متاح الآن، لذا إليك مراجعة مبنية على القواعد لأهم الأسنان.",
  };

  const script: ScriptEvent[] = [{ type: "speak", text: intro[language] }];

  for (const tooth of getNarratableTeeth(spatialContext, 4)) {
    const mainFinding = tooth.findings[0];
    const narration = {
      en: `Tooth ${tooth.toothId} has ${tooth.findings.length} notable findings. The main teaching point is ${mainFinding.label.toLowerCase()}.`,
      fr: `La dent ${tooth.toothId} présente ${tooth.findings.length} signes notables. Le point principal est ${mainFinding.label.toLowerCase()}.`,
      ar: `السن ${tooth.toothId} يحتوي على ${tooth.findings.length} ملاحظات مهمة. النقطة التعليمية الأساسية هي ${mainFinding.label}.`,
    };

    script.push(
      { type: "canvas", tool: "zoom_to_tooth", input: { tooth_id: tooth.toothId } },
      {
        type: "canvas",
        tool: "highlight_region",
        input: {
          tooth_id: tooth.toothId,
          color:
            mainFinding.tone === "urgent"
              ? "red"
              : mainFinding.tone === "watch"
                ? "yellow"
                : mainFinding.tone === "healthy"
                  ? "green"
                  : "blue",
          opacity: 0.35,
          label: mainFinding.label,
        },
      },
      { type: "speak", text: narration[language] },
      { type: "canvas", tool: "reset_view", input: {} },
    );
  }

  return script;
}
