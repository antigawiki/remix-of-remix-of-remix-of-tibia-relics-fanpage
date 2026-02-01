import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface DialogueLine {
  speaker: 'player' | string;
  text: string;
}

interface QuestDialogueProps {
  lines: DialogueLine[];
}

const QuestDialogue = ({ lines }: QuestDialogueProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 bg-secondary/30 rounded-sm p-4 border border-border">
      {lines.map((line, index) => (
        <div key={index} className="flex gap-2">
          <span className={cn(
            "font-semibold min-w-[80px] shrink-0",
            line.speaker === 'player' ? "text-maroon" : "text-gold"
          )}>
            {line.speaker === 'player' ? t('quests.player') : line.speaker}:
          </span>
          <span className="text-foreground">{line.text}</span>
        </div>
      ))}
    </div>
  );
};

export default QuestDialogue;
