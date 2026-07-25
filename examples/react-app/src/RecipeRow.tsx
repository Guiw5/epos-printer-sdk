import { memo, useState } from 'react';
import type { Recipe } from './recipes';
import { t } from './strings';

interface RecipeRowProps {
  recipe: Recipe;
  disabled: boolean;
  onRun: (recipe: Recipe) => void;
}

/**
 * One recipe: what it does, a button to run it, and the source that produced
 * it. Defined at module scope (not inside PrinterCard) so React keeps its
 * identity across renders.
 */
function RecipeRow({ recipe, disabled, onRun }: RecipeRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="recipe">
      <div className="recipe-head">
        <h4>{recipe.title}</h4>
        <p>{recipe.blurb}</p>
        <div className="recipe-actions">
          <button type="button" className="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t.hideCode : t.showCode}
          </button>
          <button type="button" onClick={() => onRun(recipe)} disabled={disabled}>
            {t.print}
          </button>
        </div>
      </div>
      {open ? <pre>{recipe.snippet}</pre> : null}
    </div>
  );
}

export default memo(RecipeRow);
