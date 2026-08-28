import updatePosition from './updatePosition';
import { getIfOccupied } from '../../util/MapAlphaChannelMatrix';

import {
  hasOverflow,
  getOverflowCost,
  getOverlapArea,
  getOverlapCost,
  getDistanceCost,
  getIntersectionCost,
  getFixedIntersectionCost,
  getAngleCost,
  getAlphaOverflowCost,
  shouldBeVisible,
} from './costFunctions';
import { head } from 'lodash';

const timeout = 12 * 60 * 60 * 1000; // 12 hours; was: 7 * 24 * 60 * 60 * 1000 (7 days)
const iterationsPerFactor = 10;

const angles = [-6, -3, -1, 0, 1, 3, 6];
const distances = [-4, -2, -1, 0, 1, 2, 4];
const factors = [30, 15, 7, 3];
const overlappingDiffs = [
  { angle: -15, distance: 0 },
  { angle: 15, distance: 0 },
  { angle: -30, distance: 0 },
  { angle: 30, distance: 0 },
  { angle: 0, distance: 10 },
  { angle: 0, distance: 20 },
];

const diffsArray = factors.map((factor) =>
  angles.reduce(
    (prev, angle) => [
      ...prev,
      ...distances.map((distance) => ({ angle: angle * factor, distance: distance * factor })),
    ],
    [],
  ),
);

function getDistance(position1, position2) {
  const a = position1.left - position2.left;
  const b = position1.top - position2.top;
  return Math.sqrt(a * a + b * b);
}

function getCloseByPositions(positions, index, maxDistance) {
  return positions
    .map((pos, i) => ({
      ...pos,
      index: i,
    }))
    .filter((pos) => !pos.allowCollision)
    .filter((pos) => pos.shouldBeVisible || !pos.allowHidden)
    .filter((pos) => {
      if (!pos.allowHidden) return true;
      if (getDistance(pos, positions[index]) < maxDistance * 3) {
        return true;
      }
      return false;
    });
}

function getCost(placement, bbox, alphaByteArray, closeByPositions) {
  const { positions, indexes } = placement;

  const overflow = getOverflowCost(positions, indexes, bbox);
  const overlap = getOverlapCost(positions, indexes, closeByPositions);
  const distance = getDistanceCost(positions, indexes);
  const angle = getAngleCost(positions, indexes);
  const intersection = getIntersectionCost(positions, indexes, closeByPositions);
  const intersectionWithFixed = getFixedIntersectionCost(positions, indexes);
  const alphaOverlap = getAlphaOverflowCost(positions, indexes, alphaByteArray);
  return (
    overflow + overlap + distance + angle + intersection + intersectionWithFixed + alphaOverlap
  );
}

function getOverlappingItem(placement, indexToOverlap) {
  const { positions } = placement;
  for (let i = 0; i < positions.length; i++) {
    if (
      i !== indexToOverlap &&
      !positions[i].isFixed &&
      (positions[i].shouldBeVisible || !positions[i].allowHidden) &&
      getOverlapArea(positions[i], positions[indexToOverlap]) > 0
    ) {
      return i;
    }
  }
  return null;
}

function getPlacements(placement, index, diffs, bbox, alphaByteArray, configuration) {
  const { positions, indexes } = placement;

  return diffs
    .map((diff) => {
      const updatedPosition = updatePosition(positions[index], diff);

      if (updatedPosition) {
        updatedPosition.shouldBeVisible = shouldBeVisible(
          updatedPosition,
          alphaByteArray,
          bbox,
          configuration,
          true,
        );
      }
      if (
        !updatedPosition ||
        (!positions[index].allowHidden && hasOverflow(updatedPosition, bbox))
      ) {
        return null;
      }
      return positions.map((position, i) => (i === index ? updatedPosition : position));
    })
    .filter((updatedPositions) => !!updatedPositions)
    .map((updatedPositions) => ({ positions: updatedPositions, indexes: [...indexes, index] }));
}

function comparePlacements(placement, other, bbox, alphaByteArray, closeByPositions) {
  const indexes = [...new Set([...placement.indexes, ...other.indexes])];
  const cost = getCost({ ...placement, indexes }, bbox, alphaByteArray, closeByPositions);
  const costOther = getCost({ ...other, indexes }, bbox, alphaByteArray, closeByPositions);
  return costOther < cost ? other : placement;
}

function getNextPlacement(initialPlacement, index, diffs, bbox, alphaByteArray, configuration) {
  const closeByPositions = getCloseByPositions(
    initialPlacement.positions,
    index,
    configuration.maxAnchorLength,
  );

  // Get potential positions for item at index
  const placements = getPlacements(
    { ...initialPlacement, indexes: [] },
    index,
    diffs,
    bbox,
    alphaByteArray,
    configuration,
  );

  // Get positions where one overlapping item is updated as well
  const placementsOverlapping = placements.reduce((prev, placement) => {
    const overlapIndex = getOverlappingItem(placement, index);
    const position = placement.positions[index];

    if (overlapIndex === null || (!position.shouldBeVisible && position.allowHidden)) {
      return prev;
    }

    return [
      ...prev,
      ...getPlacements(
        {
          positions: placement.positions,
          indexes: [index],
        },
        overlapIndex,
        overlappingDiffs,
        bbox,
        alphaByteArray,
        configuration,
      ),
    ];
  }, []);

  // const placementsOverlapping = [];

  const nextPlacement = [initialPlacement, ...placements, ...placementsOverlapping].reduce(
    (prev, cur) => comparePlacements(prev, cur, bbox, alphaByteArray, closeByPositions),
  );

  return nextPlacement;
}

function findMostSuitablePosition(initialPlacement, bbox, isOccupied, configuration) {
  const start = Date.now();
  let placement = initialPlacement;
  const totalIterations = factors.length * iterationsPerFactor;
  let iterationCounter = 0;
  const totalStartedAt = Date.now();
  for (let factor = 0; factor < factors.length; factor++) {
    const diffs = diffsArray[factor];
    for (let iteration = 0; iteration < iterationsPerFactor; iteration++) {
      iterationCounter++;
      const previous = placement;
      for (let index = 0; index < placement.positions.length; index++) {
        const startedAt = Date.now();
        if (!placement.positions[index].isFixed) {
          placement = getNextPlacement(placement, index, diffs, bbox, isOccupied, configuration);
        }
        // const elapsed = Date.now() - startedAt;
        // const totalElapsed = Date.now() - totalStartedAt;
        /* console.log( // eslint-disable-line no-console
          `index: ${index}/${placement.positions.length}, ` +
            `elapsed=${elapsed}ms, ` +
            `iteration: ${iterationCounter}/${totalIterations}, ` +
            `totalElapsed=${totalElapsed}ms`,
        ); */
        if (Date.now() - start > timeout) {
          console.log('Timeout'); // eslint-disable-line
          return placement.positions;
        }
      }
      if (placement === previous) {
        break;
      }
    }
  }
  return placement.positions;
}

function optimizePositions(initialPositions, bbox, alphaByteArray, mapOptions, configuration) {
  const placement = {
    positions: initialPositions.map((position) => updatePosition(position)),
    indexes: [],
  };

  const defaultDPI = 300;
  const marginMm = 6;
  const bboxPrintMargin = Math.round((marginMm * defaultDPI) / 25.4);

  const bboxWithMargins = {
    left: bbox.left + bboxPrintMargin,
    top: bbox.top + bboxPrintMargin,
    width: bbox.width - bboxPrintMargin * 2,
    height: bbox.height - bboxPrintMargin * 2,
  };

  const isOccupied = getIfOccupied(alphaByteArray, mapOptions);
  const positions = findMostSuitablePosition(placement, bboxWithMargins, isOccupied, configuration);

  const newPlacements = [];
  positions.forEach((position) => {
    newPlacements.push({
      ...position,
      visible: shouldBeVisible(position, isOccupied, bboxWithMargins, configuration, true),
    });
  });
  return newPlacements;
}

export default optimizePositions;
